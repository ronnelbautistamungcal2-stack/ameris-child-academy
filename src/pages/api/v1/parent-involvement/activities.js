import { getSession } from "@/lib/auth";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { eventIsForChildren, openSignupWhere, parseEvent, startOfToday, volunteerCounts } from "@/lib/parentInvolvement";
import { canManageInvolvement } from "@/lib/parentInvolvementServer";

/** Sign-ups that count toward an activity: every one for a dated event. */
export function signupWhere(activity) {
  return activity.startsAt ? { kind: "SIGNUP", activityId: activity.id } : openSignupWhere(activity.id);
}

/**
 * GET  /api/v1/parent-involvement/activities?centerId=[&view=upcoming|past]
 *      Parents: active events for their children. Staff who
 *      run events (admin, HR, coach at the center): every event, upcoming or past.
 * POST /api/v1/parent-involvement/activities?centerId=  Create Event (staff).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const centerId = req.query.centerId ? String(req.query.centerId) : "";
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  const isParent = session.user.role === "PARENT";
  let familyChildren = [];
  if (isParent) {
    familyChildren = await prisma.child.findMany({
      where: buildParentLinkedChildWhere(session.user.id, { centerId }),
      select: { id: true, birthDate: true, classRoomId: true },
    });
    if (!familyChildren.length) return res.status(403).json({ error: "Forbidden" });
  } else if (!(await canManageInvolvement(session.user, centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const today = startOfToday();
    const past = req.query.view === "past";
    const activities = await prisma.parentInvolvementActivity.findMany({
      where: {
        centerId,
        active: true,
        ...(isParent ? { status: "ACTIVE" } : {}),
        ...(past ? { endsAt: { lt: today } } : { OR: [{ endsAt: null }, { endsAt: { gte: today } }] }),
      },
      orderBy: past ? [{ startsAt: "desc" }] : [{ startsAt: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    });
    const visible = isParent ? activities.filter((a) => eventIsForChildren(a, familyChildren)) : activities;
    const signups = visible.length
      ? await prisma.parentInvolvement.findMany({
          where: { OR: visible.map((a) => signupWhere(a)) },
          select: { activityId: true, parentId: true, roleId: true },
        })
      : [];
    return res.status(200).json(
      visible.map((a) => {
        const taken = signups.filter((s) => s.activityId === a.id);
        const counts = volunteerCounts(a, taken);
        return {
          ...a,
          roles: counts.roles,
          signedUpCount: counts.filled,
          volunteersNeeded: counts.needed,
          spotsLeft: counts.needed == null ? null : Math.max(0, counts.needed - counts.filled),
          signedUp: taken.some((s) => s.parentId === session.user.id),
        };
      }),
    );
  }

  if (req.method === "POST") {
    if (isParent) return res.status(403).json({ error: "Only staff can create events" });
    const parsed = parseEvent(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const activity = await prisma.parentInvolvementActivity.create({ data: { centerId, ...parsed.data, createdById: session.user.id } });
    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
