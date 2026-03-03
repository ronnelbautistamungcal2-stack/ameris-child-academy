import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        category: true,
        goals: { orderBy: { goalIndex: "asc" } },
        remediationsFrom: { include: { toLesson: true } },
        supplies: { orderBy: { name: "asc" } },
        policyDocument: true,
      },
    });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    return res.status(200).json(lesson);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { title, description, media, categoryId, policyDocumentId, supplies } = req.body;

    const lesson = await prisma.$transaction(async (tx) => {
      if (Object.prototype.hasOwnProperty.call(req.body, "supplies") && Array.isArray(supplies)) {
        await tx.lessonSupply.deleteMany({ where: { lessonId: id } });
        if (supplies.length) {
          await tx.lessonSupply.createMany({
            data: supplies.map((s) => ({
              lessonId: id,
              name: s.name,
              quantity: s.quantity || 1,
              unit: s.unit || null,
              estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : null,
              category: s.category || "General",
              notes: s.notes || null,
            })),
          });
        }
      }

      return tx.lesson.update({
        where: { id },
        data: {
          title,
          description,
          media,
          categoryId:
            Object.prototype.hasOwnProperty.call(req.body, "categoryId")
              ? categoryId || null
              : undefined,
          policyDocumentId:
            Object.prototype.hasOwnProperty.call(req.body, "policyDocumentId")
              ? policyDocumentId || null
              : undefined,
        },
        include: {
          category: true,
          goals: { orderBy: { goalIndex: "asc" } },
          remediationsFrom: { include: { toLesson: true } },
          supplies: { orderBy: { name: "asc" } },
          policyDocument: true,
        },
      });
    });

    return res.status(200).json(lesson);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete lessons" });
    }

    await prisma.lesson.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
