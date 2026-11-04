import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canViewChildReport } from "@/lib/reportAccess";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function mediaUrls(details) {
  const d = details && typeof details === "object" ? details : {};
  const raw = [...(Array.isArray(d.media) ? d.media : []), ...(Array.isArray(d.photos) ? d.photos : [])];
  return [...new Set(raw.map((m) => (typeof m === "string" ? m : m?.url || "")).map((u) => String(u).trim()).filter(Boolean))];
}

/**
 * GET /api/v1/children/:id/photos?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Every photo taken of the child on the Daily Log in the range, newest first
 * (parent My Children Photos section, client request 2026-10-29). Same access
 * as the Student Performance Report.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const child = await prisma.child.findUnique({
    where: { id: String(req.query.id) },
    select: { id: true, centerId: true, classRoomId: true, parentId: true, guardians: { select: { guardianId: true } } },
  });
  if (!child || !(await canViewChildReport(session.user, child))) return res.status(404).json({ error: "Child not found" });

  const from = DATE.test(String(req.query.from || "")) ? new Date(`${req.query.from}T00:00:00`) : null;
  const to = DATE.test(String(req.query.to || "")) ? new Date(`${req.query.to}T00:00:00`) : null;
  if (to) to.setDate(to.getDate() + 1);
  const logs = await prisma.activityLog.findMany({
    where: { childId: child.id, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) },
    select: { id: true, type: true, details: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const photos = logs.flatMap((log) => mediaUrls(log.details).map((url, i) => ({ id: `${log.id}-${i}`, url, type: log.type, date: log.createdAt })));
  return res.status(200).json(photos);
}
