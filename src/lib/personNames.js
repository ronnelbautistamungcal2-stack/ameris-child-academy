/** One uppercase letter, or null. Used for users' and pickup people's middle initials. */
export function normalizeMiddleInitial(value) {
  const letter = String(value ?? "").trim().replace(/\./g, "").charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : null;
}

/**
 * Initials shown on time sheets: first, middle and last, e.g. "BJK" for
 * Bonnie J Kingston. Works for users (name + middleInitial) and for pickup
 * people (firstName / middleInitial / lastName).
 */
export function personInitials(person) {
  if (!person) return "";
  const nameParts = String(person.name || "").trim().split(/\s+/).filter(Boolean);
  const first = person.firstName ?? nameParts[0] ?? "";
  const last = person.lastName ?? (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
  return [first, person.middleInitial, last]
    .map((part) => String(part || "").trim().charAt(0).toUpperCase())
    .join("");
}

export function pickupPersonName(person) {
  return [person?.firstName, person?.middleInitial ? `${person.middleInitial}.` : "", person?.lastName]
    .filter(Boolean)
    .join(" ");
}
