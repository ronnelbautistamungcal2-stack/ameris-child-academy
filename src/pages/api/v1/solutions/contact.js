import prisma from "@/lib/prisma";
import { nextLeadNumber, notifyNewLead, parseLeadInput, tooManyRequests } from "@/lib/leads";

export const CONTACT_SUBJECTS = ["Pricing and plans", "Request a demo", "Support for my account", "Partnership", "Other"];

/**
 * POST /api/v1/solutions/contact  (public, no sign-in)
 * The Ameris Solutions website's Contact Us form:
 *   { contactName, email, phone?, centerName?, subject, message }
 * Saved as a lead (source Contact Us) so the Ameris team can follow up from
 * Sales & Leads; the team gets an in-app notification.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const body = req.body || {};
  if (body.website) return res.status(201).json({ ok: true }); // honeypot
  if (tooManyRequests(req)) return res.status(429).json({ error: "Too many requests. Please try again in a few minutes." });

  const subject = String(body.subject || "").trim();
  if (!CONTACT_SUBJECTS.includes(subject)) return res.status(400).json({ error: "Select a subject" });
  const message = String(body.message || "").trim().slice(0, 4000);
  if (message.length < 2) return res.status(400).json({ error: "Enter a message" });
  const parsed = parseLeadInput(
    { contactName: body.contactName, email: body.email, phone: body.phone, centerName: String(body.centerName || "").trim() || "(not given)" },
    { create: true, website: true },
  );
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      number: await nextLeadNumber(),
      status: "NEW",
      source: "CONTACT_FORM",
      about: `${subject}: ${message}`,
      activities: { create: { description: `Message from the website (${subject}).` } },
    },
  });
  await notifyNewLead(lead, "CONTACT_FORM");
  return res.status(201).json({ ok: true });
}
