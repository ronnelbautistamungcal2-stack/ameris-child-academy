import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { levelForStatus } from "@/lib/sop";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEVEL_LABELS = { NOT_STARTED: "Not Started", EXPOSURE: "Exposure", COMPETENCY: "Competency", MASTERY: "Mastery" };
const levelLabel = (status) => LEVEL_LABELS[levelForStatus(status)] || String(status || "").replace(/_/g, " ");

/**
 * GET /api/v1/reports/milestone-changes?centerId=&from=&to=[&childId=]
 * Milestone Change Log (client request 2026-10-29): every change made to a
 * child's milestone (step of progression) level in the range, what it changed
 * from and to, and who made the change. Admins and the center's coaches.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  if (!["ADMIN", "COACH"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  const { centerId, from, to, childId } = req.query;
  if (!centerId || !DATE.test(String(from || "")) || !DATE.test(String(to || ""))) {
    return res.status(400).json({ error: "centerId, from and to (YYYY-MM-DD) are required" });
  }
  if (!(await hasAccessToCenter(session.user.id, String(centerId)))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const [children, entries] = await Promise.all([
    prisma.child.findMany({ where: { centerId: String(centerId) }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.progressEntry.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
        progress: { lesson: { isStep: true }, child: { centerId: String(centerId), ...(childId ? { id: String(childId) } : {}) } },
      },
      include: {
        recordedBy: { select: { name: true, email: true } },
        progress: { select: { id: true, childId: true, lesson: { select: { title: true, subCategory: true, category: { select: { name: true } } } } } },
      },
      orderBy: { occurredAt: "asc" },
      take: 3000,
    }),
  ]);
  // The level before each change: the entry before it on the same goal.
  const progressIds = [...new Set(entries.map((e) => e.progressId))];
  const earlier = progressIds.length
    ? await prisma.progressEntry.findMany({ where: { progressId: { in: progressIds }, occurredAt: { lt: end } }, select: { id: true, progressId: true, status: true, occurredAt: true }, orderBy: { occurredAt: "asc" } })
    : [];
  const history = new Map();
  for (const e of earlier) (history.get(e.progressId) || history.set(e.progressId, []).get(e.progressId)).push(e);
  const names = new Map(children.map((c) => [c.id, `${c.firstName || ""} ${c.lastName || ""}`.trim()]));

  // Only real changes (client sheet 2026-11-07): an entry with an earlier level
  // that differs. A step's first assessment, or a save that kept the same
  // level, is not listed.
  const rows = entries.flatMap((e) => {
    const list = history.get(e.progressId) || [];
    const i = list.findIndex((x) => x.id === e.id);
    const previous = i > 0 ? list[i - 1] : null;
    if (!previous || levelForStatus(previous.status) === levelForStatus(e.status)) return [];
    return [{
      id: e.id,
      date: e.occurredAt,
      childId: e.progress.childId,
      child: names.get(e.progress.childId) || "",
      category: e.progress.lesson.category?.name || "General",
      milestone: e.progress.lesson.title,
      from: levelLabel(previous.status),
      to: levelLabel(e.status),
      changedBy: e.recordedBy?.name || e.recordedBy?.email || "—",
      notes: e.notes || "",
    }];
  });
  return res.status(200).json({ from, to, children: children.map((c) => ({ id: c.id, name: names.get(c.id) })), rows });
}
