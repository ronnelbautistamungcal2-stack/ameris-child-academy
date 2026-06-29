import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULTS = { evaluationWeight: 50, checklistWeight: 50, lateDeductionPct: 1, absenceDeductionPct: 2 };

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "OTHER_STAFF"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });

    const { centerId } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    if (req.method === "GET") {
      const config = await prisma.otherStaffGradeConfig.findUnique({ where: { centerId } });
      return res.status(200).json(config || { centerId, ...DEFAULTS });
    }

    if (req.method === "PUT") {
      if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can update grade config" });
      const { evaluationWeight, checklistWeight, lateDeductionPct, absenceDeductionPct } = req.body || {};
      const ew = Number(evaluationWeight ?? DEFAULTS.evaluationWeight);
      const cw = Number(checklistWeight ?? DEFAULTS.checklistWeight);
      const ld = Number(lateDeductionPct ?? DEFAULTS.lateDeductionPct);
      const ad = Number(absenceDeductionPct ?? DEFAULTS.absenceDeductionPct);
      const config = await prisma.otherStaffGradeConfig.upsert({
        where: { centerId },
        create: { centerId, evaluationWeight: ew, checklistWeight: cw, lateDeductionPct: ld, absenceDeductionPct: ad },
        update: { evaluationWeight: ew, checklistWeight: cw, lateDeductionPct: ld, absenceDeductionPct: ad },
      });
      return res.status(200).json(config);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("other-staff-grade-config error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
