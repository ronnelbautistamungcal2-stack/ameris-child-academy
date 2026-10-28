// Forms & Renewals (client request 36-01, C3/D4/D5): a parent's form is filled
// from the child's profile and ends with a certification the parent signs by
// typing their name; the center can pull up the signed forms later.

export const CERTIFICATION_STATEMENT =
  "I certify that I have reviewed the information on this form, including the information from my child's profile, and that it is accurate and complete to the best of my knowledge.";

/** Values from the child's profile that a form field can be filled from. */
export function childFormValues(profile) {
  if (!profile?.child) return {};
  const c = profile.child;
  const parents = profile.family?.parents || [];
  const emergency = profile.emergency?.contacts || [];
  const birth = c.birthDate ? new Date(c.birthDate).toISOString().slice(0, 10) : "";
  return {
    childName: [c.firstName, c.lastName].filter(Boolean).join(" "),
    childFirstName: c.firstName || "",
    childLastName: c.lastName || "",
    birthDate: birth,
    dateOfBirth: birth,
    classroom: profile.classroom?.name || "",
    parent1Name: parents[0]?.name || "",
    parent1Phone: parents[0]?.phone || "",
    parent1Email: parents[0]?.email || "",
    parent2Name: parents[1]?.name || "",
    parent2Phone: parents[1]?.phone || "",
    parent2Email: parents[1]?.email || "",
    address: parents.find((p) => p.address)?.address || "",
    emergency1Name: emergency[0]?.name || "",
    emergency1Phone: emergency[0]?.phone || "",
    emergency2Name: emergency[1]?.name || "",
    emergency2Phone: emergency[1]?.phone || "",
    allergies: profile.about?.allergies || "",
    medicalConditions: profile.about?.medicalInfo || "",
    pediatricianName: profile.emergency?.pediatrician?.name || "",
    pediatricianPhone: profile.emergency?.pediatrician?.phone || "",
  };
}

/**
 * Start values for a form: a field takes the profile value whose key matches
 * its name, or the key the template's autoFillMapping names for it.
 */
export function prefillFromProfile(fields, mapping, profile) {
  const values = childFormValues(profile);
  const map = mapping && typeof mapping === "object" && !Array.isArray(mapping) ? mapping : {};
  const out = {};
  for (const field of fields) {
    const key = map[field.name] || field.name;
    if (values[key]) out[field.name] = values[key];
  }
  return out;
}

/** The stored certification: the statement, the typed name and when (server time). */
export function buildCertification(input, user, now = new Date()) {
  const signedName = String(input?.signedName || "").trim().slice(0, 120);
  if (!signedName || input?.agreed !== true) return null;
  return { statement: CERTIFICATION_STATEMENT, signedName, signedAt: now.toISOString(), signedById: user.id };
}
