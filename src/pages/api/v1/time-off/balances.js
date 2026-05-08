import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";
import { getTimeOffBalanceSummary, roundHours } from "@/lib/time-off";

function parsePositiveHours(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return NaN;
  return roundHours(hours);
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function loadEntries(userId, centerId) {
  return prisma.timeOffBalanceEntry.findMany({
    where: {
      userId,
      centerId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ earnedDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isEmployeeRole(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, userId } = req.query || {};
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const resolvedUserId = isNonAdminEmployeeRole(session.user.role)
      ? session.user.id
      : userId;
    if (!resolvedUserId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (session.user.role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
    }

    const [summary, entries] = await Promise.all([
      getTimeOffBalanceSummary(prisma, {
        userId: resolvedUserId,
        centerId,
      }),
      loadEntries(resolvedUserId, centerId),
    ]);

    return res.status(200).json({
      userId: resolvedUserId,
      centerId,
      summary,
      entries,
    });
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can manage time-off balances" });
    }

    const { centerId, userId, earnedDate, paidHours, unpaidHours, note } = req.body || {};
    if (!centerId || !userId || !earnedDate) {
      return res.status(400).json({
        error: "centerId, userId, and earnedDate are required",
      });
    }

    const parsedEarnedDate = parseDateOrNull(earnedDate);
    if (!parsedEarnedDate) {
      return res.status(400).json({ error: "Invalid earnedDate" });
    }

    const parsedPaidHours = parsePositiveHours(paidHours);
    const parsedUnpaidHours = parsePositiveHours(unpaidHours);
    if (Number.isNaN(parsedPaidHours) || Number.isNaN(parsedUnpaidHours)) {
      return res.status(400).json({ error: "Hours must be zero or greater" });
    }
    if (parsedPaidHours <= 0 && parsedUnpaidHours <= 0) {
      return res.status(400).json({
        error: "Enter paid hours, unpaid hours, or both",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (parsedPaidHours > 0) {
        await tx.timeOffBalanceEntry.create({
          data: {
            userId,
            centerId,
            balanceType: "PAID",
            hours: parsedPaidHours,
            earnedDate: parsedEarnedDate,
            note: note ? String(note).trim() : null,
            createdById: session.user.id,
          },
        });
      }

      if (parsedUnpaidHours > 0) {
        await tx.timeOffBalanceEntry.create({
          data: {
            userId,
            centerId,
            balanceType: "UNPAID",
            hours: parsedUnpaidHours,
            earnedDate: parsedEarnedDate,
            note: note ? String(note).trim() : null,
            createdById: session.user.id,
          },
        });
      }
    });

    const [summary, entries] = await Promise.all([
      getTimeOffBalanceSummary(prisma, {
        userId,
        centerId,
      }),
      loadEntries(userId, centerId),
    ]);

    return res.status(201).json({
      userId,
      centerId,
      summary,
      entries,
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
