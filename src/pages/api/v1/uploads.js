import { getSession } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function safeBaseName(name) {
  const raw = typeof name === "string" ? name : "file";
  const base = raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "");
  return base || "file";
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { filename, mimeType, dataBase64 } = req.body || {};
  if (!dataBase64 || typeof dataBase64 !== "string") {
    return res.status(400).json({ error: "dataBase64 is required" });
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64" });
  }

  if (!buffer.length) return res.status(400).json({ error: "Empty file" });
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: "File too large (max 10MB)" });
  }

  const base = safeBaseName(filename);
  const ext = path.extname(base).slice(0, 10);
  const id = crypto.randomUUID();
  const outName = `${id}${ext || ""}`;

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, outName), buffer);

  return res.status(200).json({
    url: `/uploads/${outName}`,
    originalName: base,
    mimeType: typeof mimeType === "string" ? mimeType : null,
    size: buffer.length,
  });
}
