// "None", "N/A", "NA" and the like typed into an allergy or medical condition
// field mean there isn't one (client sheet 10-29 (11), row 44: they showed as
// an allergy).

const NONE = new Set(["none", "n/a", "na", "n.a", "no", "nil", "nka", "nkda", "no allergies", "no known allergies", "no known food allergies", "not applicable", "-", "--"]);

/** True for text that only says there is none. */
export function isNoneText(value) {
  const t = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/, "")
    .replace(/\s+/g, " ");
  return !t || NONE.has(t);
}

/** The real entries of a comma / semicolon / line separated list, as one line ("" when none). */
export function realListText(value) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => !isNoneText(s))
    .join(", ");
}
