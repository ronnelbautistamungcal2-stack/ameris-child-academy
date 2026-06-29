import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { centerId, staffId } = req.query;

    if (req.method === "GET") {
      if (!["ADMIN", "OTHER_STAFF"].includes(session.user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      const resolvedStaffId = session.user.role === "OTHER_STAFF" ? session.user.id : staffId;
      const records = await prisma.staffCitation.findMany({
        where: { centerId, ...(resolvedStaffId ? { staffId: resolvedStaffId } : {}) },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      });
      return res.status(200).json(records);
    }

    if (req.method === "POST") {
      if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can add citations" });
      const { centerId: bc, staffId: bs, text, date } = req.body || {};
      if (!bc || !bs || !text?.trim()) return res.status(400).json({ error: "centerId, staffId, and text are required" });
      const record = await prisma.staffCitation.create({
        data: { centerId: bc, staffId: bs, text: text.trim(), date: date ? new Date(date) : new Date(), createdById: session.user.id },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      return res.status(201).json(record);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("staff-citations error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
