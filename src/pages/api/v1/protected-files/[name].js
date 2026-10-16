import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import {
  PROTECTED_DIR,
  PROTECTED_MIME_TYPES,
  PROTECTED_NAME_PATTERN,
} from "@/lib/protectedFiles";

export const config = {
  api: { responseLimit: false },
};

// Serves protected lesson files to signed-in staff only. The viewer renders
// them onto a canvas; these headers keep the browser from caching them or
// offering them as a download.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const name = String(req.query?.name || "").toLowerCase();
  if (!PROTECTED_NAME_PATTERN.test(name)) {
    return res.status(404).json({ error: "Not found" });
  }

  let buffer;
  try {
    buffer = await fs.readFile(path.join(PROTECTED_DIR, name));
  } catch {
    return res.status(404).json({ error: "Not found" });
  }

  res.setHeader("Content-Type", PROTECTED_MIME_TYPES[path.extname(name)]);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  return res.status(200).send(buffer);
}
