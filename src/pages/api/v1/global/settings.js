import crypto from "crypto";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";
import { NOTIFICATION_LABELS, getAgreements, getGeneral, saveAgreements, validateGeneral } from "@/lib/globalSettings";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET   /api/v1/global/settings -> { general, notificationLabels, templates, agreements }
 * PUT   /api/v1/global/settings { general }            Save Changes (General tab)
 * POST  /api/v1/global/settings { agreement: { name, version, effectiveDate, fileUrl } }
 *       Upload New Agreement (becomes the current one)
 * PATCH /api/v1/global/settings { currentAgreementId } chooses the current agreement
 * Global admin > Settings > General (client mockup 2026-11-06).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SETTINGS");
  if (!session) return undefined;

  if (req.method === "GET") {
    const [general, templates, agreements] = await Promise.all([
      getGeneral(),
      prisma.emailTemplate.findMany({ orderBy: { name: "asc" } }),
      getAgreements(),
    ]);
    return res.status(200).json({ general, notificationLabels: NOTIFICATION_LABELS, templates, agreements });
  }

  if (req.method === "PUT") {
    const parsed = validateGeneral(req.body?.general);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    await prisma.globalSetting.upsert({
      where: { key: "general" },
      create: { key: "general", value: parsed.data, updatedById: session.user.id },
      update: { value: parsed.data, updatedById: session.user.id },
    });
    return res.status(200).json({ general: parsed.data });
  }

  if (req.method === "POST") {
    const a = req.body?.agreement || {};
    const name = String(a.name || "").trim().slice(0, 150);
    const version = String(a.version || "").trim().slice(0, 30);
    const fileUrl = String(a.fileUrl || "").trim();
    if (!name || !version) return res.status(400).json({ error: "Enter the agreement name and version" });
    if (!DATE.test(String(a.effectiveDate || ""))) return res.status(400).json({ error: "Choose the effective date" });
    if (!/^\/(uploads|api\/v1\/uploaded-files)\/[\w.-]+$/.test(fileUrl)) return res.status(400).json({ error: "Upload the agreement file" });
    const list = (await getAgreements()).map((x) => ({ ...x, current: false }));
    list.push({ id: crypto.randomUUID(), name, version, effectiveDate: a.effectiveDate, fileUrl, current: true, uploadedAt: new Date().toISOString() });
    await saveAgreements(list, session.user.id);
    return res.status(201).json({ agreements: await getAgreements() });
  }

  if (req.method === "PATCH") {
    const id = String(req.body?.currentAgreementId || "");
    const list = await getAgreements();
    if (!list.some((x) => x.id === id)) return res.status(404).json({ error: "Agreement not found" });
    await saveAgreements(
      list.map((x) => ({ ...x, current: x.id === id })),
      session.user.id,
    );
    return res.status(200).json({ agreements: await getAgreements() });
  }

  res.setHeader("Allow", ["GET", "PUT", "POST", "PATCH"]);
  return res.status(405).end();
}
