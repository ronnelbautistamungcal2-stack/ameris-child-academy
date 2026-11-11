import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";

/**
 * PUT /api/v1/global/email-templates/:id { name, subject, body, active }
 * Settings > Email Templates > Edit. Templates are saved now and used once an
 * email service is connected.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SETTINGS");
  if (!session) return undefined;
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }
  const id = String(req.query.id || "");
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: "Template not found" });
  const body = req.body || {};
  const name = String(body.name ?? template.name).trim().slice(0, 100);
  const subject = String(body.subject ?? template.subject).trim().slice(0, 200);
  const text = String(body.body ?? template.body).slice(0, 20000);
  if (!name) return res.status(400).json({ error: "Template Name is required" });
  if (!subject) return res.status(400).json({ error: "Subject Line is required" });
  if (!text.trim()) return res.status(400).json({ error: "Body is required" });
  const updated = await prisma.emailTemplate.update({
    where: { id },
    data: { name, subject, body: text, active: body.active === undefined ? template.active : Boolean(body.active), updatedById: session.user.id },
  });
  return res.status(200).json(updated);
}
