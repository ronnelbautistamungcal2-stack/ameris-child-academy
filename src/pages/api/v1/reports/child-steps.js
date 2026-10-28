import { getSession, hasAccessToCenter } from "@/lib/auth";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { childStepsReport, milestoneParams } from "@/lib/milestoneReports";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";

const CHILD_SELECT = { id: true, firstName: true, lastName: true, birthDate: true, centerId: true, enrollmentEndDate: true, center: { select: { name: true } } };

/**
 * GET /api/v1/reports/child-steps[?centerId=]   the children the user can pick
 * GET /api/v1/reports/child-steps?childId=&date=&minMonths=&maxMonths=&categoryId=&subCategory=&achieved=yes|no
 * Child Steps of Progression Report: admins, coaches and Student Support (children at
 * their centers) and parents (their own children).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!hasAnyRole(session.user, ["ADMIN", "COACH", "STUDENT_SUPPORT", "PARENT"])) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const isStaff = hasAnyRole(session.user, ["ADMIN", "COACH", "STUDENT_SUPPORT"]);

  async function canSee(child) {
    if (session.user.role === "ADMIN") return true;
    if (isStaff && (await hasAccessToCenter(session.user.id, child.centerId))) return true;
    const own = await prisma.child.findFirst({ where: { AND: [{ id: child.id }, buildParentLinkedChildWhere(session.user.id)] }, select: { id: true } });
    return Boolean(own);
  }

  if (!req.query.childId) {
    const centerId = req.query.centerId ? String(req.query.centerId) : "";
    let where;
    if (isStaff) {
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) return res.status(403).json({ error: "Forbidden" });
      where = { centerId };
    } else {
      where = buildParentLinkedChildWhere(session.user.id);
    }
    const children = await prisma.child.findMany({ where, select: CHILD_SELECT, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
    return res.status(200).json({
      children: children.map((c) => ({
        id: c.id,
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        centerName: c.center?.name || "",
        enrolled: !c.enrollmentEndDate || c.enrollmentEndDate >= new Date(new Date().setHours(0, 0, 0, 0)),
      })),
    });
  }

  const child = await prisma.child.findUnique({ where: { id: String(req.query.childId) }, select: CHILD_SELECT });
  if (!child) return res.status(404).json({ error: "Child not found" });
  if (!(await canSee(child))) return res.status(403).json({ error: "Forbidden" });
  const params = milestoneParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });
  return res.status(200).json({ center: { id: child.centerId, name: child.center?.name || "" }, ...params, ...(await childStepsReport({ child, ...params })) });
}
