import { getSession } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".pdf",
]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res
      .status(403)
      .json({ error: "Only teachers and admins can upload files" });
  }

  if (req.method === "POST") {
    const { file, fileName } = req.body;

    if (!file || !fileName) {
      return res.status(400).json({ error: "file and fileName required" });
    }

    try {
      if (typeof file !== "string" || typeof fileName !== "string") {
        return res.status(400).json({ error: "Invalid payload" });
      }

      // Ensure upload directory exists
      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      // Decode base64 file
      const buffer = Buffer.from(file, "base64");
      if (!buffer.length) {
        return res.status(400).json({ error: "Invalid base64 file" });
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: "File too large" });
      }

      const fileExt = path.extname(fileName);
      if (!ALLOWED_EXTENSIONS.has(fileExt.toLowerCase())) {
        return res.status(400).json({ error: "File type not allowed" });
      }

      const baseName = path.basename(fileName, fileExt);
      const timestamp = Date.now();
      const safeBaseName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "upload";
      const uniqueFileName = `${safeBaseName}_${timestamp}${fileExt.toLowerCase()}`;
      const filePath = path.join(UPLOAD_DIR, uniqueFileName);

      // Write file
      await fs.writeFile(filePath, buffer);

      const fileUrl = `/uploads/${uniqueFileName}`;

      return res.status(201).json({
        fileName: uniqueFileName,
        url: fileUrl,
        size: buffer.length,
        uploadedAt: new Date(),
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: "File upload failed" });
    }
  }

  res.setHeader("Allow", ["POST"]);
  res.status(405).end();
}
