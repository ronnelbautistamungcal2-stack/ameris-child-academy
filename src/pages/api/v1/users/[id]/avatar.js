import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;
  const canManageAvatar = session.user.role === "ADMIN" || session.user.id === id;
  if (!canManageAvatar) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "DELETE") {
    await prisma.user.update({
      where: { id },
      data: { pictureUrl: null },
      select: { id: true, pictureUrl: true },
    });

    return res.status(200).json({ pictureUrl: null });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end();
  }

  const { filename, mimeType, dataBase64 } = req.body || {};
  if (!dataBase64 || typeof dataBase64 !== "string") {
    return res.status(400).json({ error: "Image data is required" });
  }

  if (!ALLOWED_MIME_TYPES.has(String(mimeType || ""))) {
    return res.status(400).json({ error: "Only JPG, PNG, WEBP, and GIF images are supported" });
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid image encoding" });
  }

  if (!buffer.length) return res.status(400).json({ error: "Image file is empty" });
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: "Image must be 5MB or smaller" });
  }

  const ext = resolveExtension(filename, mimeType);
  const outName = `avatar-${id}-${crypto.randomUUID()}${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, outName), buffer);

  const pictureUrl = `/uploads/${outName}`;

  await prisma.user.update({
    where: { id },
    data: { pictureUrl },
    select: { id: true, pictureUrl: true },
  });

  return res.status(200).json({
    pictureUrl,
    size: buffer.length,
    mimeType,
  });
}

function resolveExtension(filename, mimeType) {
  const fromName = path.extname(String(filename || "")).toLowerCase();
  if (fromName && Object.values(MIME_EXTENSION_MAP).includes(fromName)) {
    return fromName;
  }
  return MIME_EXTENSION_MAP[String(mimeType)] || ".jpg";
}
