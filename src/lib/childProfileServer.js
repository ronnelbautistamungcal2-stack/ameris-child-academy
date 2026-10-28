// Student Profile on the server (client mockups 07-01..03): who may see it,
// what they may change, and the profile in the shape the page shows.

import { getEmergencyContacts, getParentContacts } from "@/lib/child-contacts";
import { buildParentLinkedChildWhere, isChildLinkedToParent } from "@/lib/child-parent-links";
import { normalizeCarePlan, normalizeHealthInfo, normalizeSchedule, redFlags, scheduleSummary } from "@/lib/childProfile";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { childStatus } from "@/lib/sop";
import { canUseChild, loadChildSteps } from "@/lib/sopServer";

const OPEN_PLAN_STATUSES = ["ACTIVE", "UNDER_REVIEW", "NEEDS_UPDATE"];

export const PROFILE_INCLUDE = {
  center: { select: { id: true, name: true } },
  classRoom: { select: { id: true, name: true, teachers: { select: { teacher: { select: { name: true, email: true } } } } } },
  parent: { select: { id: true, name: true, email: true } },
  guardians: { select: { guardianId: true, relationship: true, guardian: { select: { id: true, name: true, email: true } } } },
  pickupPeople: { select: { pickupPerson: { select: { firstName: true, middleInitial: true, lastName: true } } } },
  behaviorPlans: { where: { status: { in: OPEN_PLAN_STATUSES } }, select: { id: true, title: true } },
};

/**
 * What the user may do with this child's profile: view (staff who track the
 * child, linked parents), editAll (admins: Edit Profile), editFamily (linked
 * parents: family, emergency contacts, About and the photo). Teachers only
 * view (client request 07-02).
 */
export async function profileAccess(user, child) {
  if (!child) return { view: false };
  if (hasAnyRole(user, ["ADMIN"])) return { view: true, editAll: true, editFamily: true };
  if (hasAnyRole(user, ["PARENT"]) && isChildLinkedToParent(child, user.id)) return { view: true, editAll: false, editFamily: true };
  if (await canUseChild(user, child)) return { view: true, editAll: false, editFamily: false };
  return { view: false };
}

function fullName(person) {
  return [person?.firstName, person?.middleInitial, person?.lastName].filter(Boolean).join(" ");
}

/** Children shown in the profile's switcher: a parent's own children, else the child's classroom. */
async function switcherChildren(user, child) {
  const where = hasAnyRole(user, ["PARENT"]) && !hasAnyRole(user, ["ADMIN"])
    ? buildParentLinkedChildWhere(user.id)
    : child.classRoomId
      ? { classRoomId: child.classRoomId, OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }] }
      : { id: child.id };
  const rows = await prisma.child.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, photoUrl: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 40,
  });
  return rows.some((r) => r.id === child.id) ? rows : [{ id: child.id, firstName: child.firstName, lastName: child.lastName, photoUrl: child.photoUrl }, ...rows];
}

export async function buildProfile(user, child, access) {
  const steps = await loadChildSteps(child).catch(() => []);
  const goals = steps.filter((s) => s.active).map((s) => ({ step: s, level: s.level || "NOT_STARTED" }));
  const schedule = normalizeSchedule(child.schedule);
  const linkedParents = [
    ...(child.parent ? [{ id: child.parent.id, name: child.parent.name, email: child.parent.email, relationship: "" }] : []),
    ...child.guardians.filter((g) => g.guardianId !== child.parentId).map((g) => ({ id: g.guardian.id, name: g.guardian.name, email: g.guardian.email, relationship: g.relationship || "" })),
  ];
  return {
    child: {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName || "",
      birthDate: child.birthDate,
      photoUrl: child.photoUrl,
      enrollmentStartDate: child.enrollmentStartDate,
      enrollmentEndDate: child.enrollmentEndDate,
      centerId: child.centerId,
      classRoomId: child.classRoomId,
    },
    snapshot: child.snapshotNotes || "",
    classroom: {
      name: child.classRoom?.name || "",
      teachers: (child.classRoom?.teachers || []).map((t) => t.teacher.name || t.teacher.email),
      schedule: scheduleSummary(schedule),
      startDate: child.enrollmentStartDate,
      status: goals.length ? childStatus(goals, child.birthDate) : null,
      center: child.center?.name || "",
    },
    family: {
      parents: getParentContacts(child),
      linkedParents,
      authorizedPickup: child.pickupPeople.map((p) => fullName(p.pickupPerson)),
    },
    emergency: {
      contacts: getEmergencyContacts(child),
      outOfArea: child.outOfAreaContact || null,
      pediatrician: normalizeHealthInfo(child.healthInfo).pediatrician,
    },
    about: {
      favoriteActivities: child.favoriteActivities || "",
      strengths: child.strengths || "",
      areasOfFocus: child.areasOfFocus || "",
      allergies: child.allergies || "",
      medicalInfo: normalizeHealthInfo(child.healthInfo).conditions.join(", "),
      languages: child.languages || "",
      snapshotNotes: child.snapshotNotes || "",
      additionalNotes: normalizeCarePlan(child.carePlan).otherInformation,
    },
    redFlags: redFlags(child, child.behaviorPlans),
    schedule,
    healthInfo: normalizeHealthInfo(child.healthInfo),
    carePlan: access.editAll ? normalizeCarePlan(child.carePlan) : undefined,
    switcher: await switcherChildren(user, child),
    access: { editAll: Boolean(access.editAll), editFamily: Boolean(access.editFamily) },
  };
}
