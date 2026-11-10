import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { classroomAccess } from "@/lib/lessonPlanAccess";
import { classroomCurriculum } from "@/lib/curriculumSource";

/**
 * PUT /api/v1/lesson-calendar/age-group { centerId, classRoomId, ageGroupId }
 * Admin only (step E). Which Ameris age group a subscriber classroom follows;
 * it must be one of the age groups on the account. Blank clears it.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "PUT") {
      res.setHeader("Allow", ["PUT"]);
      return res.status(405).end();
    }
    const { centerId, classRoomId, ageGroupId } = req.body || {};
    const access = await classroomAccess(session.user, centerId, classRoomId, { admin: true });
    if (access.error) return res.status(access.status).json({ error: access.error });

    const curriculum = await classroomCurriculum(classRoomId);
    if (curriculum?.mode !== "AMERIS") {
      return res.status(400).json({ error: "This classroom uses its own Lesson Planner" });
    }
    const id = ageGroupId ? String(ageGroupId) : null;
    if (id && !curriculum.ageGroups.some((g) => g.id === id)) {
      return res.status(400).json({ error: "That age group is not on your subscription" });
    }
    await prisma.classRoom.update({ where: { id: access.classRoom.id }, data: { curriculumAgeGroupId: id } });
    return res.status(200).json({ ok: true, ageGroupId: id });
  } catch (e) {
    console.error("lesson calendar age group error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
