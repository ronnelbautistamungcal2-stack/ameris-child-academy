import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EDITOR_ROLES = ["ADMIN", "COACH", "HR_STAFF"];

/**
 * "Move Staff for Today" (Staff Attendance Overview).
 * PUT    { centerId, userId, date, toClassRoomId | null }  moves them for the day
 * DELETE { centerId, userId, date }                          puts them back
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!EDITOR_ROLES.includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  if (!["PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  }

  const { centerId, userId, date } = req.body || {};
  if (!centerId || !userId || !DATE.test(String(date || ""))) {
    return res.status(400).json({ error: "centerId, userId and date are required" });
  }
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const member = await prisma.centerUser.findFirst({ where: { userId, centerId } });
  if (!member) return res.status(400).json({ error: "That staff member is not at this center" });
  const day = new Date(`${date}T00:00:00.000Z`);

  if (req.method === "DELETE") {
    await prisma.staffDayMove.deleteMany({ where: { userId, date: day } });
    return res.status(200).json({ deleted: true });
  }

  const toClassRoomId = req.body.toClassRoomId || null;
  if (toClassRoomId) {
    const room = await prisma.classRoom.findFirst({ where: { id: toClassRoomId, centerId } });
    if (!room) return res.status(400).json({ error: "Choose a classroom at this center" });
  }
  const home = await prisma.teacherClass.findFirst({ where: { teacherId: userId, classRoom: { centerId } }, select: { classId: true } });
  const move = await prisma.staffDayMove.upsert({
    where: { userId_date: { userId, date: day } },
    update: { centerId, toClassRoomId, movedById: session.user.id },
    create: { userId, centerId, date: day, fromClassRoomId: home?.classId || null, toClassRoomId, movedById: session.user.id },
  });
  return res.status(200).json(move);
}
