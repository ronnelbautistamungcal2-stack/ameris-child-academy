import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";
import {
  calculateTimeOffHours,
  decorateTimeOffRequest,
  getTimeOffBalanceSummary,
  resolveTimeOffBalanceType,
} from "@/lib/time-off";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Only employees can update time off" });
    }
    if (req.method !== "PUT") {
      res.setHeader("Allow", ["PUT"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    const request = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    const { status, reviewNotes, coverageName } = req.body || {};

    // Only admin can approve/deny
    if (["APPROVED", "DENIED"].includes(status) && session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can approve or deny requests" });
    }

    if (
      status === "CANCELLED" &&
      isNonAdminEmployeeRole(session.user.role) &&
      request.userId !== session.user.id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const normalizedCoverageName = String(coverageName || "").trim();
    const data = {};
    if (status) data.status = status;
    if (status === "APPROVED") {
      const balanceType = resolveTimeOffBalanceType(request.type);
      if (balanceType) {
        const summary = await getTimeOffBalanceSummary(prisma, {
          userId: request.userId,
          centerId: request.centerId,
          excludeApprovedRequestId: request.status === "APPROVED" ? request.id : "",
        });
        const requestHours = calculateTimeOffHours(
          request.startDate,
          request.endDate,
        );
        const availableHours =
          balanceType === "PAID"
            ? summary.paidAvailable
            : summary.unpaidAvailable;
        if (requestHours > availableHours) {
          return res.status(400).json({
            error: `Not enough ${balanceType.toLowerCase()} hours available for this request`,
          });
        }
      }
    }
    if (["APPROVED", "DENIED"].includes(status)) {
      data.reviewedById = session.user.id;
      data.reviewedAt = new Date();
    }
    if (reviewNotes !== undefined) data.reviewNotes = reviewNotes;
    if (status === "APPROVED") {
      data.coverageName = normalizedCoverageName || null;
    } else if (status === "DENIED" || status === "CANCELLED") {
      data.coverageName = null;
    } else if (coverageName !== undefined && request.status === "APPROVED") {
      data.coverageName = normalizedCoverageName || null;
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    return res.status(200).json(decorateTimeOffRequest(updated));
  } catch (e) {
    console.error("time-off/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
