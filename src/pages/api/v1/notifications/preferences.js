import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, unauthorized } from "@/lib/api-error";
import { ensureObject, optionalBoolean, requiredString } from "@/lib/validation";

const ALL_TYPES = ["MESSAGE", "COMPLIANCE_ALERT", "ACTIVITY_UPDATE", "PROGRESS_UPDATE", "SYSTEM", "FORM_RENEWAL"];

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const userId = session.user.id;

  if (req.method === "GET") {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    const prefMap = {};
    for (const pref of prefs) prefMap[pref.type] = pref.enabled;

    return res.status(200).json(
      ALL_TYPES.map((type) => ({
        type,
        enabled: prefMap[type] !== undefined ? prefMap[type] : true,
      })),
    );
  }

  const body = ensureObject(req.body || {});
  const type = requiredString(body, "type");
  const enabled = optionalBoolean(body, "enabled");
  if (!ALL_TYPES.includes(type) || enabled === undefined) {
    return res.status(400).json({
      ok: false,
      message: "type and enabled (boolean) are required",
      error: {
        code: "BAD_REQUEST",
        message: "type and enabled (boolean) are required",
      },
    });
  }

  const pref = await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    update: { enabled },
    create: { userId, type, enabled },
  });
  return res.status(200).json(pref);
}, { methods: ["GET", "PUT"], logLabel: "notifications/preferences error:" });
