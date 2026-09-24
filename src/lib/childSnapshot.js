/**
 * The "Child Snapshot" a family keeps on the parent portal: the short profile
 * lines that describe who the child is, plus the profile photo the switcher
 * and the header card use. Allergies already lived on Child, so the snapshot
 * edits it in place rather than duplicating it.
 *
 * The Child Profile page adds the rest of what a family knows best (home
 * address, pick-up list, pediatrician, languages) through the same endpoint.
 * Contacts and classroom details stay with the center's full child record.
 */

export const CHILD_SNAPSHOT_TEXT_FIELDS = [
  "favoriteActivities",
  "strengths",
  "areasOfFocus",
  "allergies",
  "snapshotNotes",
  "profileSummary",
  "languages",
  "medicalInfo",
  "homeAddress",
  "authorizedPickup",
  "pediatricianName",
  "pediatricianPhone",
  "emergencyNotes",
];

export const CHILD_SNAPSHOT_FIELDS = ["photoUrl", ...CHILD_SNAPSHOT_TEXT_FIELDS];

const MAX_TEXT_LENGTH = 2000;
const MAX_PHOTO_URL_LENGTH = 512;

export const childSnapshotSelect = {
  photoUrl: true,
  favoriteActivities: true,
  strengths: true,
  areasOfFocus: true,
  allergies: true,
  snapshotNotes: true,
  profileSummary: true,
  languages: true,
  medicalInfo: true,
  homeAddress: true,
  authorizedPickup: true,
  pediatricianName: true,
  pediatricianPhone: true,
  emergencyNotes: true,
};

export function pickChildSnapshot(child) {
  const source = child && typeof child === "object" ? child : {};
  const snapshot = {};
  for (const field of CHILD_SNAPSHOT_FIELDS) {
    snapshot[field] = source[field] ?? null;
  }
  return snapshot;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Photos only ever come back from our own uploads endpoint, so keep the stored
 * value to that shape. Anything else (a javascript: URL, a tracking pixel on
 * somebody else's host) is rejected rather than quietly saved.
 */
function normalizePhotoUrl(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_PHOTO_URL_LENGTH) return undefined;
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Builds the Prisma `data` for a snapshot save. Only keys present on the body
 * are touched, so a partial save never blanks a field somebody else filled in.
 * Returns `{ data }` on success or `{ error }` when a value is unusable.
 */
export function buildChildSnapshotUpdate(body) {
  const source = body && typeof body === "object" ? body : {};
  const data = {};

  for (const field of CHILD_SNAPSHOT_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    const normalized = normalizeText(source[field]);
    if (normalized === undefined) {
      return { error: `${field} must be text` };
    }
    data[field] = normalized;
  }

  if (Object.prototype.hasOwnProperty.call(source, "photoUrl")) {
    const normalized = normalizePhotoUrl(source.photoUrl);
    if (normalized === undefined) {
      return { error: "photoUrl must be an uploaded image path" };
    }
    data.photoUrl = normalized;
  }

  if (!Object.keys(data).length) return { error: "No snapshot fields provided" };
  return { data };
}
