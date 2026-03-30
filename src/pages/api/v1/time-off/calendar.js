import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const where = {
      centerId,
      status: "APPROVED",
    };

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      if (fromDate && toDate) {
        where.startDate = { lte: toDate };
        where.endDate = { gte: fromDate };
      } else if (fromDate) {
        where.endDate = { gte: fromDate };
      } else if (toDate) {
        where.startDate = { lte: toDate };
      }
    }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    });

    return res.status(200).json(requests);
  } catch (e) {
    console.error("time-off/calendar error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
