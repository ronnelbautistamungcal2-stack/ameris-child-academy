import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALL_TYPES = ["MESSAGE", "COMPLIANCE_ALERT", "ACTIVITY_UPDATE", "PROGRESS_UPDATE", "SYSTEM"];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  if (req.method === "GET") {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    const prefMap = {};
    for (const p of prefs) prefMap[p.type] = p.enabled;

    const result = ALL_TYPES.map((type) => ({
      type,
      enabled: prefMap[type] !== undefined ? prefMap[type] : true,
    }));
    return res.status(200).json(result);
  }

  if (req.method === "PUT") {
    const { type, enabled } = req.body || {};
    if (!ALL_TYPES.includes(type) || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "type and enabled (boolean) are required" });
    }

    const pref = await prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      update: { enabled },
      create: { userId, type, enabled },
    });
    return res.status(200).json(pref);
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  res.status(405).end();
}
