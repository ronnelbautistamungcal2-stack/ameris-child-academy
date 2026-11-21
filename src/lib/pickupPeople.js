import { hasAccessToCenter } from "@/lib/auth";
import { isChildLinkedToParent, linkedParentAccountsInclude } from "@/lib/child-parent-links";
import { pinStatusOf } from "@/lib/kioskPins";
import { normalizeMiddleInitial } from "@/lib/personNames";

export const PICKUP_PERSON_INCLUDE = {
  kioskCredential: true,
  user: { select: { id: true, name: true, email: true } },
};

/**
 * API shape of a pickup person: never the PIN or its hashes. `linkedUser` is
 * the staff member or parent they are; they sign in with that account's PIN.
 */
export function serializePickupPerson(person) {
  if (!person) return person;
  const { kioskCredential, user, ...rest } = person;
  return {
    ...rest,
    linkedUser: user ? { id: user.id, name: user.name, email: user.email } : null,
    pinStatus: pinStatusOf(kioskCredential),
  };
}

/** Users who can be picked as a pickup person at a center: its staff and its children's parents. */
export function pickupUserScope(centerId) {
  return {
    OR: [
      { centers: { some: { centerId } } },
      { children: { some: { centerId } } },
      { guardianships: { some: { child: { centerId } } } },
    ],
  };
}

/** First name, middle initial and last name from a user's full name. */
export function splitUserName(user) {
  const parts = String(user?.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  const fromName = parts.length > 2 && /^[A-Za-z]\.?$/.test(parts[1]) ? parts[1].replace(".", "") : "";
  return {
    firstName: firstName.slice(0, 100),
    middleInitial: normalizeMiddleInitial(user?.middleInitial || fromName) || null,
    lastName: lastName.slice(0, 100),
  };
}

/** Validates the name fields of a new or edited pickup person. */
export function parsePickupPersonInput(body = {}, { partial = false } = {}) {
  const data = {};
  for (const field of ["firstName", "lastName"]) {
    if (partial && !(field in body)) continue;
    const value = String(body[field] ?? "").trim();
    if (!value) return { error: `${field === "firstName" ? "First" : "Last"} name is required` };
    data[field] = value.slice(0, 100);
  }
  if (!partial || "middleInitial" in body) {
    const middleInitial = normalizeMiddleInitial(body.middleInitial);
    if (!middleInitial) return { error: "Middle initial is required" };
    data.middleInitial = middleInitial;
  }
  if ("phone" in body) data.phone = String(body.phone || "").trim().slice(0, 40) || null;
  return { data };
}

/**
 * Loads a child and decides what the session may do with its pickup list:
 * admins manage it; coaches and teachers at the child's center and the
 * child's parents may only view it (client: parents cannot change this tab).
 * Returns { child, canView, canManage } or { status, error }.
 */
export async function loadChildPickupAccess(prisma, session, childId) {
  const child = await prisma.child.findUnique({
    where: { id: String(childId) },
    include: linkedParentAccountsInclude,
  });
  if (!child) return { status: 404, error: "Child not found" };
  const role = session.user.role;
  if (role === "ADMIN") return { child, canView: true, canManage: true };
  if (role === "PARENT") {
    return isChildLinkedToParent(child, session.user.id)
      ? { child, canView: true, canManage: false }
      : { status: 403, error: "Forbidden" };
  }
  if (["COACH", "TEACHER"].includes(role) && (await hasAccessToCenter(session.user.id, child.centerId))) {
    return { child, canView: true, canManage: false };
  }
  return { status: 403, error: "Forbidden" };
}
