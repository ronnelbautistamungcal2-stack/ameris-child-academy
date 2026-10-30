import { getSession } from "@/lib/auth";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { INVOLVEMENT_NOTES_MAX, involvementSignature, parseInvolvementWindow } from "@/lib/parentInvolvement";
import { canManageInvolvement } from "@/lib/parentInvolvementServer";
import { signupWhere } from "./activities";

const CHILD_SELECT = { id: true, firstName: true, lastName: true };
export const ENTRY_INCLUDE = {
  activity: { select: { id: true, title: true, startsAt: true, location: true } },
  parent: { select: { id: true, name: true, email: true } },
  child: { select: CHILD_SELECT },
  children: { select: CHILD_SELECT },
};

/**
 * GET  /api/v1/parent-involvement            a parent's own history
 * GET  /api/v1/parent-involvement?centerId=[&kind=LOG|SIGNUP&parentId=&activityId=]
 *      Volunteer Tracking (staff who run events at the center)
 * POST /api/v1/parent-involvement
 *      parent: { kind: LOG|SIGNUP, activityId, childIds, date, startTime, endTime,
 *                notes, roleId (sign-up), signature { agreed, signedName } (log) }
 *      staff:  { parentId, activityId, childIds, date, hours, notes }  a tracking row
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const isParent = session.user.role === "PARENT";

  if (req.method === "GET") {
    const where = {};
    if (isParent) {
      where.parentId = session.user.id;
    } else {
      const centerId = req.query.centerId ? String(req.query.centerId) : "";
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (!(await canManageInvolvement(session.user, centerId))) return res.status(403).json({ error: "Forbidden" });
      where.activity = { centerId };
      if (req.query.parentId) where.parentId = String(req.query.parentId);
      if (req.query.activityId) where.activityId = String(req.query.activityId);
      if (["LOG", "SIGNUP"].includes(req.query.kind)) where.kind = req.query.kind;
    }
    const involvements = await prisma.parentInvolvement.findMany({ where, include: ENTRY_INCLUDE, orderBy: { occurredAt: "desc" }, take: 500 });
    return res.status(200).json(involvements);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  const body = req.body || {};
  if (!body.activityId) return res.status(400).json({ error: "Choose an activity" });
  const activity = await prisma.parentInvolvementActivity.findUnique({ where: { id: String(body.activityId) } });
  if (!activity || !activity.active) return res.status(404).json({ error: "Activity not found" });
  const ids = [...new Set(Array.isArray(body.childIds) ? body.childIds.filter(Boolean).map(String) : [])];
  if (!ids.length) return res.status(400).json({ error: "Select at least one child" });
  const cleanNotes = body.notes ? String(body.notes).trim() : "";
  if (cleanNotes.length > INVOLVEMENT_NOTES_MAX) return res.status(400).json({ error: `Notes must be ${INVOLVEMENT_NOTES_MAX} characters or fewer` });
  const children = await prisma.child.findMany({ where: { id: { in: ids } }, include: { guardians: { select: { guardianId: true } } } });

  // Staff add a row on Volunteer Tracking for a parent.
  if (!isParent) {
    if (!(await canManageInvolvement(session.user, activity.centerId))) return res.status(403).json({ error: "Forbidden" });
    const parentId = String(body.parentId || "");
    if (!parentId) return res.status(400).json({ error: "Choose the parent" });
    if (children.length !== ids.length || !children.every((c) => c.centerId === activity.centerId && isChildLinkedToParent(c, parentId))) {
      return res.status(400).json({ error: "Those children are not linked to that parent" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))) return res.status(400).json({ error: "Choose the date" });
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return res.status(400).json({ error: "Enter the hours (up to 24)" });
    const record = await prisma.parentInvolvement.create({
      data: {
        kind: "LOG",
        activityId: activity.id,
        parentId,
        childId: ids.length === 1 ? ids[0] : null,
        children: { connect: ids.map((id) => ({ id })) },
        notes: cleanNotes || null,
        occurredAt: new Date(`${body.date}T12:00:00`),
        hours: Math.round(hours * 100) / 100,
        enteredById: session.user.id,
      },
      include: ENTRY_INCLUDE,
    });
    return res.status(201).json(record);
  }

  const kind = body.kind === "SIGNUP" ? "SIGNUP" : "LOG";
  if (children.length !== ids.length || !children.every((c) => c.centerId === activity.centerId && isChildLinkedToParent(c, session.user.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const window = parseInvolvementWindow(body);
  if (window.error) return res.status(400).json({ error: window.error });

  let role = null;
  let signature = null;
  if (kind === "SIGNUP") {
    if (activity.status !== "ACTIVE") return res.status(409).json({ error: "This event is not open for sign-ups yet" });
    const taken = await prisma.parentInvolvement.findMany({ where: signupWhere(activity), select: { parentId: true, roleId: true } });
    if (taken.some((s) => s.parentId === session.user.id)) return res.status(409).json({ error: "You are already signed up for this opportunity" });
    const roles = Array.isArray(activity.roles) ? activity.roles : [];
    if (roles.length) {
      role = roles.find((r) => r.id === body.roleId);
      if (!role) return res.status(400).json({ error: "Choose a volunteer role" });
      if (role.needed && taken.filter((s) => s.roleId === role.id).length >= role.needed) return res.status(409).json({ error: `${role.name} is full` });
    }
    if (activity.capacity != null && taken.length >= activity.capacity) return res.status(409).json({ error: "This opportunity is full" });
  } else {
    // Logged hours carry the parent's e-signature (shown on the tracking export).
    signature = involvementSignature(body.signature, session.user.id);
    if (!signature) return res.status(400).json({ error: "Check the certification and type your full name to sign" });
  }

  const record = await prisma.parentInvolvement.create({
    data: {
      kind,
      activityId: activity.id,
      parentId: session.user.id,
      childId: ids.length === 1 ? ids[0] : null,
      children: { connect: ids.map((id) => ({ id })) },
      notes: cleanNotes || null,
      occurredAt: window.start,
      endedAt: window.end,
      hours: window.hours,
      roleId: role?.id || null,
      roleName: role?.name || null,
      signature,
    },
    include: ENTRY_INCLUDE,
  });
  return res.status(201).json(record);
}
