import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    const evaluation = await prisma.teacherEvaluation.findUnique({ where: { id } });
    if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });

    if (evaluation.teacherId !== session.user.id) {
      return res.status(403).json({ error: "Only the evaluated employee can acknowledge" });
    }

    if (evaluation.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Only submitted evaluations can be acknowledged" });
    }

    const updated = await prisma.teacherEvaluation.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        teacherAcknowledgedAt: new Date(),
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        evaluator: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("evaluations/[id]/acknowledge error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
