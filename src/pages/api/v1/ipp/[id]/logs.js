import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { displayName } from "@/lib/ipp";
import { loadIppForUser } from "@/lib/ippAccess";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST   /api/v1/ipp/:id/logs  { date, goalId?, tactic, tacticDetail?, observation? }
 * DELETE /api/v1/ipp/:id/logs?logId=
 * IPP Log entries. Teachers and managers add them; managers or the person
 * who entered one can delete it.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;
    const access = await loadIppForUser(user, req.query.id, { goals: { select: { id: true } } });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const plan = access.plan;

    if (req.method === "POST") {
      if (!access.canLog) return res.status(403).json({ error: "Only staff can add to the IPP log" });
      const { date, goalId } = req.body || {};
      const tactic = String(req.body?.tactic || "").trim().slice(0, 200);
      if (!DATE.test(String(date || ""))) return res.status(400).json({ error: "Choose a date" });
      if (!tactic) return res.status(400).json({ error: "Enter the tactic used" });
      if (goalId && !plan.goals.some((g) => g.id === goalId)) return res.status(400).json({ error: "That goal is not on this plan" });
      const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
      const log = await prisma.behaviorPlanLog.create({
        data: {
          planId: plan.id,
          goalId: goalId || null,
          date: new Date(`${date}T00:00:00.000Z`),
          tactic,
          tacticDetail: String(req.body?.tacticDetail || "").trim().slice(0, 500) || null,
          observation: String(req.body?.observation || "").trim().slice(0, 1000) || null,
          enteredById: user.id,
          enteredByName: displayName(me),
        },
        select: { id: true },
      });
      return res.status(201).json(log);
    }

    if (req.method === "DELETE") {
      const log = await prisma.behaviorPlanLog.findFirst({ where: { id: String(req.query.logId || ""), planId: plan.id } });
      if (!log) return res.status(404).json({ error: "Log entry not found" });
      if (!access.canManage && log.enteredById !== user.id) return res.status(403).json({ error: "You can only delete your own entries" });
      await prisma.behaviorPlanLog.delete({ where: { id: log.id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("ipp logs error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
