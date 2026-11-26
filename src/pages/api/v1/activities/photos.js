import fs from "fs/promises";
import path from "path";
import { activityPhotoUrls } from "@/components/reports/ActivityPhotos";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildZip } from "@/lib/zipStore";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LOGS = 3000;
const MAX_ZIP_FILES = 500;

/**
 * Daily Log photos (client sheet 10-29 (11), row 22): every photo on the
 * center's Daily Log entries for the dates, optionally one classroom.
 * GET /api/v1/activities/photos?centerId=&classRoomId=&from=&to=
 *     -> { photos: [{ url, childName, classroom, type, at }] }
 * GET ...&download=zip[&only=url,url]  -> the photos (or the chosen ones) as a .zip
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  if (!["ADMIN", "COACH"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  const { centerId, classRoomId, from, to } = req.query;
  if (!centerId || !DATE.test(String(from || "")) || !DATE.test(String(to || ""))) {
    return res.status(400).json({ error: "centerId, from and to (YYYY-MM-DD) are required" });
  }
  if (!(await hasAccessToCenter(session.user.id, String(centerId)))) return res.status(403).json({ error: "Forbidden" });

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const logs = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      child: { centerId: String(centerId), ...(classRoomId ? { classRoomId: String(classRoomId) } : {}) },
    },
    select: { type: true, details: true, createdAt: true, child: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: MAX_LOGS,
  });
  const photos = [];
  for (const log of logs) {
    for (const url of activityPhotoUrls(log)) {
      photos.push({
        url,
        childName: [log.child.firstName, log.child.lastName].filter(Boolean).join(" "),
        classroom: log.child.classRoom?.name || "",
        type: log.type,
        at: log.createdAt,
      });
    }
  }

  if (req.query.download !== "zip") return res.status(200).json({ photos });

  const only = String(req.query.only || "").split(",").filter(Boolean);
  const chosen = (only.length ? photos.filter((p) => only.includes(p.url)) : photos).slice(0, MAX_ZIP_FILES);
  const files = [];
  const used = new Set();
  for (const p of chosen) {
    // Only files saved by the app's uploads (public/uploads); no other paths.
    const m = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(p.url);
    if (!m) continue;
    let data;
    try {
      data = await fs.readFile(path.join(process.cwd(), "public", "uploads", m[1]));
    } catch {
      continue;
    }
    const day = new Date(p.at).toISOString().slice(0, 10);
    const base = `${day} ${p.childName || "Child"}`.replace(/[^A-Za-z0-9 _-]+/g, "").trim();
    const ext = path.extname(m[1]) || ".jpg";
    let name = `${base}${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base} (${n})${ext}`;
    used.add(name.toLowerCase());
    files.push({ name, data, date: new Date(p.at) });
  }
  if (!files.length) return res.status(404).json({ error: "No photos to download" });
  const zip = buildZip(files);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="daily-log-photos-${from}-to-${to}.zip"`);
  res.setHeader("Content-Length", zip.length);
  return res.status(200).send(zip);
}
