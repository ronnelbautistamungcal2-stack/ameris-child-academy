import { hasAccessToCenter } from "@/lib/auth";
import { isChildLinkedToParent, linkedParentAccountsInclude } from "@/lib/child-parent-links";
import { pinStatusOf } from "@/lib/kioskPins";
import { normalizeMiddleInitial } from "@/lib/personNames";

export const PICKUP_PERSON_INCLUDE = { kioskCredential: true };

/** API shape of a pickup person: never the PIN or its hashes. */
export function serializePickupPerson(person) {
  if (!person) return person;
  const { kioskCredential, ...rest } = person;
  return { ...rest, pinStatus: pinStatusOf(kioskCredential) };
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
