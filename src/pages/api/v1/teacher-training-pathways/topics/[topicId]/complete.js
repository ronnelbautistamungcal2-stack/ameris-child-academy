import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { topicId } = req.query;
    const topic = await prisma.teacherTrainingTopic.findUnique({
      where: { id: topicId },
      include: { pathway: { select: { centerId: true } } },
    });
    if (!topic) return res.status(404).json({ error: "Training topic not found" });

    const allowed = await hasAccessToCenter(session.user.id, topic.pathway.centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "POST") {
      const completion = await prisma.teacherTrainingTopicCompletion.upsert({
        where: { topicId_teacherId: { topicId, teacherId: session.user.id } },
        create: { topicId, teacherId: session.user.id },
        update: {},
      });
      return res.status(200).json(completion);
    }

    if (req.method === "DELETE") {
      await prisma.teacherTrainingTopicCompletion.deleteMany({
        where: { topicId, teacherId: session.user.id },
      });
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end();
  } catch (error) {
    console.error("teacher-training-pathways/topics/[topicId]/complete error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
