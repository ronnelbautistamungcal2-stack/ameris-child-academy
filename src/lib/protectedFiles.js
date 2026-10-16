import path from "path";

// Lesson documents that teachers may view but not download. Kept outside
// public/ so Next never serves them as static files.
export const PROTECTED_DIR = path.join(process.cwd(), "storage", "protected-lessons");

export const PROTECTED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

export const PROTECTED_MIME_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Only names the upload endpoint itself generates: a UUID plus an allowed
// extension. Rules out path traversal without any further checks.
export const PROTECTED_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$/;
