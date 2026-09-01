import crypto from "crypto";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";
import {
  getTimeOffAvailabilityWarning,
  decorateTimeOffRequest,
  normalizeTimeOffType,
  isUnexcusedType,
  calculateTimeOffHours,
  splitTimeOffRangeIntoWorkdays,
} from "@/lib/time-off";

function applyRequestDateRange(where, from, to) {
  const startDate = from ? new Date(from) : null;
  const endDate = to ? new Date(to) : null;
  if (!startDate && !endDate) return;

  if (startDate && endDate) {
    where.startDate = { lte: endDate };
    where.endDate = { gte: startDate };
    return;
  }

  if (startDate) {
    where.endDate = { gte: startDate };
    return;
  }

  where.startDate = { lte: endDate };
}

function applySubmittedRange(where, submittedFrom, submittedTo) {
  if (!submittedFrom && !submittedTo) return;
  where.createdAt = {};
  if (submittedFrom) where.createdAt.gte = new Date(submittedFrom);
  if (submittedTo) {
    const end = new Date(submittedTo);
    end.setHours(23, 59, 59, 999);
    where.createdAt.lte = end;
  }
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Only employees can access time off" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("time-off error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, userId, status, from, to, submittedFrom, submittedTo } = req.query;
  if (centerId && session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const where = {};
  if (centerId) where.centerId = centerId;
  if (status) where.status = status;
  applyRequestDateRange(where, from, to);
  applySubmittedRange(where, submittedFrom, submittedTo);

  if (isNonAdminEmployeeRole(session.user.role)) {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  const requests = await prisma.timeOffRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return res.status(200).json(requests.map(decorateTimeOffRequest));
}

async function handlePost(req, res, session) {
  const {
    centerId,
    type,
    startDate,
    endDate,
    reason,
    coverageName,
    userId,
    overrideBalanceWarning,
  } = req.body || {};
  if (!centerId || !startDate || !endDate) {
    return res.status(400).json({ error: "centerId, startDate, and endDate are required" });
  }
  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return res.status(400).json({ error: "endDate must be after startDate" });

  const unexcused = isUnexcusedType(type);
  if (unexcused && session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can record unexcused time off" });
  }
  if (unexcused && !userId) {
    return res.status(400).json({ error: "userId is required for unexcused time off" });
  }

  const targetUserId = unexcused ? userId : session.user.id;

  // A request spanning multiple calendar days is split into one row per
  // weekday (sharing a requestGroupId) so admins can approve or deny
  // individual days, while the employee still only fills out one form.
  // Unexcused entries are single administrative records, so they're never
  // split even if they span multiple days.
  const workdaySplit = unexcused ? null : splitTimeOffRangeIntoWorkdays(start, end);
  if (workdaySplit && workdaySplit.length === 0) {
    return res.status(400).json({ error: "Selected range doesn't include any weekdays" });
  }
  const days = workdaySplit && workdaySplit.length > 1 ? workdaySplit : null;

  // Unexcused time off is an administrative record of what already happened,
  // so it skips the balance-overage warning and reduces unpaid hours directly,
  // even below zero.
  if (!unexcused) {
    const normalizedType = normalizeTimeOffType(type);
    const totalHours = days
      ? days.reduce((sum, day) => sum + calculateTimeOffHours(day.startDate, day.endDate), 0)
      : undefined;
    const warning = await getTimeOffAvailabilityWarning(prisma, {
      userId: targetUserId,
      centerId,
      type: normalizedType,
      startDate: start,
      endDate: end,
      precomputedHours: totalHours,
    });
    if (warning.overLimit && !overrideBalanceWarning) {
      return res.status(409).json({
        error: `This request exceeds the employee's ${warning.balanceType.toLowerCase()} hours available`,
        code: "TIME_OFF_BALANCE_WARNING",
        canProceed: true,
        warning,
      });
    }
  }

  const baseData = {
    userId: targetUserId,
    centerId,
    type: unexcused ? "UNEXCUSED" : normalizeTimeOffType(type),
    reason: reason || null,
    ...(unexcused
      ? {
          status: "APPROVED",
          coverageName: String(coverageName || "").trim() || null,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        }
      : {}),
  };

  if (days) {
    const requestGroupId = crypto.randomUUID();
    const created = await prisma.$transaction(
      days.map((day) =>
        prisma.timeOffRequest.create({
          data: {
            ...baseData,
            requestGroupId,
            startDate: day.startDate,
            endDate: day.endDate,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ),
    );
    return res.status(201).json({
      requestGroupId,
      requests: created.map(decorateTimeOffRequest),
    });
  }

  const request = await prisma.timeOffRequest.create({
    data: {
      ...baseData,
      startDate: workdaySplit ? workdaySplit[0].startDate : start,
      endDate: workdaySplit ? workdaySplit[0].endDate : end,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(decorateTimeOffRequest(request));
}
