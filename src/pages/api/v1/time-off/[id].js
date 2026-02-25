import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "PUT") {
      res.setHeader("Allow", ["PUT"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    const request = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    const { status, reviewNotes } = req.body || {};

    // Only admin can approve/deny
    if (["APPROVED", "DENIED"].includes(status) && session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can approve or deny requests" });
    }

    // Teacher can only cancel their own
    if (status === "CANCELLED" && session.user.role === "TEACHER" && request.userId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const data = {};
    if (status) data.status = status;
    if (["APPROVED", "DENIED"].includes(status)) {
      data.reviewedById = session.user.id;
      data.reviewedAt = new Date();
    }
    if (reviewNotes !== undefined) data.reviewNotes = reviewNotes;

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("time-off/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
