export function getTeacherChildProfileFlags(child) {
  const flags = [];

  if (child?.allergies) flags.push("Allergies");
  if (!child?.birthDate) flags.push("Missing DOB");
  if (!child?.effectiveClassRoomId && !child?.defaultClassRoomId && !child?.classRoomId) {
    flags.push("Missing classroom");
  }
  if (
    !child?.emergencyContact &&
    (!Array.isArray(child?.emergencyContacts) || child.emergencyContacts.length === 0)
  ) {
    flags.push("Missing emergency contact");
  }

  return flags;
}

export function isTeacherChildRedFlagged(child) {
  return getTeacherChildProfileFlags(child).length > 0;
}
