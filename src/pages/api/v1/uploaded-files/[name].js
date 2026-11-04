import fs from "fs/promises";
import path from "path";

export const config = {
  api: { responseLimit: false },
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/;
const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * GET /uploads/:name (rewritten here when public/ has no such file): uploads
 * saved after the last build. Same access as public/uploads, which never
 * needed a sign-in.
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }
  const name = String(req.query?.name || "");
  if (!NAME.test(name) || name.includes("..")) return res.status(404).json({ error: "Not found" });

  let buffer;
  try {
    buffer = await fs.readFile(path.join(UPLOADS_DIR, name));
  } catch {
    return res.status(404).json({ error: "Not found" });
  }
  const type = MIME_TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  // SVGs can carry script; download them rather than render them inline.
  res.setHeader("Content-Disposition", type === "image/svg+xml" ? "attachment" : "inline");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(req.method === "HEAD" ? "" : buffer);
}
