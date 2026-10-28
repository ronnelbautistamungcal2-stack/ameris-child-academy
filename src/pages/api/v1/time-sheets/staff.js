import { accessibleCenterIds, getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, roleLabel, userRoles } from "@/lib/roles";
import { startOfLocalDay, TIME_SHEET_KINDS } from "@/lib/timeSheets";

// Employees whose time sheets the signed-in admin, coach or HR user may open
// (Staff List), with today's clock-in status. Non-admins see their centers only.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!TIME_SHEET_KINDS.staff.editorRoles.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const centerIds = await accessibleCenterIds(session.user.id);
  const requested = req.query.centerId ? String(req.query.centerId) : null;
  const scope = requested ? (centerIds && !centerIds.includes(requested) ? [] : [requested]) : centerIds;

  const users = await prisma.user.findMany({
    where: {
      disabled: false,
      OR: [{ role: { in: EMPLOYEE_ROLES } }, { roles: { hasSome: EMPLOYEE_ROLES } }],
      ...(scope ? { centers: { some: { centerId: { in: scope } } } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      employmentStatus: true,
      staffAttendances: {
        where: { date: startOfLocalDay(new Date()) },
        select: { clockIn: true, clockOut: true },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return res.status(200).json(
    users.map((user) => {
      const today = user.staffAttendances[0];
      return {
        id: user.id,
        name: user.name || user.email,
        role: userRoles(user).map(roleLabel).join(", "),
        employmentStatus: user.employmentStatus,
        clockedIn: Boolean(today?.clockIn && !today?.clockOut),
        clockIn: today?.clockIn || null,
        clockOut: today?.clockOut || null,
      };
    }),
  );
}
