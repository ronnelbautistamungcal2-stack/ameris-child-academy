import { getSession } from "@/lib/auth";
import { centerStaff, loadPathways, loadProgress, staffProgressRows, trainingAccess } from "@/lib/trainingServer";

/**
 * GET /api/v1/training/progress?centerId=
 * Staff Progress (admins, coaches, HR): each current staff member on each
 * active pathway that applies to them, with trainings completed and progress.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const access = await trainingAccess(session, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (!access.canTrack) return res.status(403).json({ error: "Forbidden" });

  const [staff, pathways] = await Promise.all([centerStaff(centerId), loadPathways(centerId, { active: true })]);
  const progress = await loadProgress(staff.map((s) => s.id), pathways.flatMap((p) => p.items.map((i) => i.id)));
  return res.status(200).json(staffProgressRows(staff, pathways, progress));
}
