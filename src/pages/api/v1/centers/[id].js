import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  // Check access unless admin
  if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, id);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const center = await prisma.center.findUnique({
      where: { id },
      include: {
        users: true,
        classes: true,
        subscription: true,
        children: true,
      },
    });
    if (!center) return res.status(404).json({ error: "Center not found" });
    return res.status(200).json(center);
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update centers" });
    }

    const { name, address } = req.body;
    const center = await prisma.center.update({
      where: { id },
      data: { name, address },
      include: { users: true, classes: true },
    });
    return res.status(200).json(center);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete centers" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Collect IDs for nested deletions
        const childIds = (await tx.child.findMany({ where: { centerId: id }, select: { id: true } })).map(c => c.id);
        const classroomIds = (await tx.classRoom.findMany({ where: { centerId: id }, select: { id: true } })).map(c => c.id);
        const checklistIds = (await tx.taskChecklist.findMany({ where: { centerId: id }, select: { id: true } })).map(c => c.id);

        // Delete child-related records (deepest first)
        if (childIds.length) {
          await tx.progress.updateMany({ where: { childId: { in: childIds } }, data: { previousGoalId: null } });
          await tx.progressEntry.deleteMany({ where: { progress: { childId: { in: childIds } } } });
          await tx.progress.deleteMany({ where: { childId: { in: childIds } } });
          await tx.activityLog.deleteMany({ where: { childId: { in: childIds } } });
          await tx.formSubmission.deleteMany({ where: { childId: { in: childIds } } });
          await tx.childTask.deleteMany({ where: { childId: { in: childIds } } });
        }

        // Attendance
        await tx.attendance.deleteMany({ where: { centerId: id } });

        // Children (ChildGuardian, MilestoneChecklistItemCompletion cascade)
        await tx.child.deleteMany({ where: { centerId: id } });

        // Tasks and checklists
        if (checklistIds.length) {
          const taskIds = (await tx.task.findMany({ where: { checklistId: { in: checklistIds } }, select: { id: true } })).map(t => t.id);
          if (taskIds.length) {
            await tx.childTask.deleteMany({ where: { taskId: { in: taskIds } } });
          }
          await tx.task.deleteMany({ where: { checklistId: { in: checklistIds } } });
        }
        await tx.taskChecklist.deleteMany({ where: { centerId: id } });

        // Classrooms
        if (classroomIds.length) {
          await tx.teacherClass.deleteMany({ where: { classId: { in: classroomIds } } });
        }
        await tx.classRoom.deleteMany({ where: { centerId: id } });

        // Lessons (LessonGoal, LessonRemediation cascade)
        await tx.lesson.deleteMany({ where: { centerId: id } });

        // Message threads (ThreadParticipant, Message cascade)
        await tx.messageThread.deleteMany({ where: { centerId: id } });

        // Form templates (FormSubmission cascades)
        await tx.formTemplate.deleteMany({ where: { centerId: id } });

        // Remaining direct relations
        await tx.policyDocument.deleteMany({ where: { centerId: id } });
        await tx.subscription.deleteMany({ where: { centerId: id } });
        await tx.centerUser.deleteMany({ where: { centerId: id } });
        await tx.progressArchive.deleteMany({ where: { centerId: id } });

        // Delete center (remaining relations with onDelete:Cascade auto-clean)
        await tx.center.delete({ where: { id } });
      });
    } catch (err) {
      console.error("Failed to delete center:", err);
      return res.status(500).json({ error: "Failed to delete center" });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
