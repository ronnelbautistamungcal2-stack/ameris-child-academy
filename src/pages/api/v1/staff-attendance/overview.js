import { getSession, hasAccessToCenter } from "@/lib/auth";
import { EMPLOYED_WHERE } from "@/lib/employment";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, roleLabel, userRoles } from "@/lib/roles";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VIEWER_ROLES = ["ADMIN", "COACH", "HR_STAFF"];
const STAFF_ROLES = EMPLOYEE_ROLES.filter((r) => r !== "ADMIN");

const localDay = (key) => new Date(`${key}T00:00:00`);
const dbDay = (key) => new Date(`${key}T00:00:00.000Z`);

/**
 * GET /api/v1/staff-attendance/overview?centerId=&from=&to=&date=
 * Staff Attendance Overview (coaches, HR, admins): each currently employed
 * staff member's hours worked from..to, and on `date` their sign in/out, shift
 * and classroom.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!VIEWER_ROLES.includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const { centerId, from, to, date } = req.query;
  if (!centerId || ![from, to, date].every((v) => DATE.test(String(v || "")))) {
    return res.status(400).json({ error: "centerId, from, to and date (YYYY-MM-DD) are required" });
  }
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, String(centerId)))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const members = await prisma.user.findMany({
    where: {
      ...EMPLOYED_WHERE,
      centers: { some: { centerId: String(centerId) } },
      OR: [{ role: { in: STAFF_ROLES } }, { roles: { hasSome: STAFF_ROLES } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      staffDepartment: true,
      pictureUrl: true,
      teacherClasses: { where: { classRoom: { centerId: String(centerId) } }, select: { classId: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  const ids = members.map((m) => m.id);
  const rangeEnd = localDay(to);
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const dayStart = localDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [worked, today, shifts, classrooms] = await Promise.all([
    prisma.staffAttendance.findMany({
      where: { userId: { in: ids }, date: { gte: localDay(from), lt: rangeEnd }, clockIn: { not: null }, clockOut: { not: null } },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
    prisma.staffAttendance.findMany({
      where: { userId: { in: ids }, date: { gte: dayStart, lt: dayEnd } },
      select: { userId: true, clockIn: true, clockOut: true, status: true },
    }),
    prisma.shiftSchedule.findMany({
      where: { userId: { in: ids }, centerId: String(centerId), date: dbDay(date) },
      select: { userId: true, startTime: true, endTime: true, position: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.classRoom.findMany({ where: { centerId: String(centerId) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const roomName = new Map(classrooms.map((c) => [c.id, c.name]));

  const staff = members.map((m) => {
    const hours = worked
      .filter((w) => w.userId === m.id)
      .reduce((sum, w) => sum + Math.max(0, (new Date(w.clockOut) - new Date(w.clockIn)) / 3600000), 0);
    const att = today.find((t) => t.userId === m.id);
    const shift = shifts.find((s) => s.userId === m.id);
    const classRoomId = m.teacherClasses[0]?.classId || null;
    const role = userRoles(m).find((r) => STAFF_ROLES.includes(r)) || m.role;
    return {
      id: m.id,
      name: m.name || m.email,
      pictureUrl: m.pictureUrl || null,
      role,
      department: m.staffDepartment || "",
      position: shift?.position || m.staffDepartment || roleLabel(role),
      totalHours: Math.round(hours * 100) / 100,
      clockIn: att?.clockIn || null,
      clockOut: att?.clockOut || null,
      status: att?.status || null,
      shift: shift ? { startTime: shift.startTime, endTime: shift.endTime } : null,
      classRoomId,
      classRoomName: classRoomId ? roomName.get(classRoomId) || "" : "",
    };
  });

  staff.sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name));
  return res.status(200).json({ staff, classrooms });
}
