import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  if (req.method === "PATCH") {
    const { title, description, targetRole, schema, centerId, active, requiresRenewal, renewalPeriodDays, autoFillMapping } = req.body || {};
    const data = {};

    if (typeof title === "string") data.title = title;
    if (typeof description === "string" || description === null) data.description = description;
    if (typeof targetRole === "string") data.targetRole = targetRole;
    if (schema !== undefined) data.schema = schema;
    if (centerId === null || typeof centerId === "string") data.centerId = centerId;
    if (typeof active === "boolean") data.active = active;
    if (typeof requiresRenewal === "boolean") data.requiresRenewal = requiresRenewal;
    if (renewalPeriodDays !== undefined) data.renewalPeriodDays = renewalPeriodDays ? parseInt(renewalPeriodDays) : null;
    if (autoFillMapping !== undefined) data.autoFillMapping = autoFillMapping;

    const updated = await prisma.formTemplate.update({
      where: { id },
      data,
    });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", ["PATCH"]);
  res.status(405).end();
}
