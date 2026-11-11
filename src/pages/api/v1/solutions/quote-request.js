import prisma from "@/lib/prisma";
import { leadInclude, nextLeadNumber, notifyNewLead, parseLeadInput, tooManyRequests } from "@/lib/leads";

/**
 * POST /api/v1/solutions/quote-request  (public, no sign-in)
 * The Ameris Solutions website's Request a Quote form. Creates a New Lead in
 * Global admin > Sales & Leads and tells the Ameris team.
 *   { centerName, contactName, email, phone?, bestTime?, about?, locations,
 *     addOns: [], pricingSelection: { children, programType, curriculumVersion,
 *     classrooms, homeDaycareProgram } }
 * `website` (a hidden field) must stay empty; bots fill it in.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const body = req.body || {};
  if (body.website) return res.status(201).json({ ok: true }); // honeypot
  if (tooManyRequests(req)) return res.status(429).json({ error: "Too many requests. Please try again in a few minutes." });

  const parsed = parseLeadInput(
    { ...body, pricingSelection: { ...(body.pricingSelection || {}), billingCycle: "MONTHLY" } },
    { create: true, website: true },
  );
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      number: await nextLeadNumber(),
      status: "NEW",
      source: "QUOTE_REQUEST",
      activities: { create: { description: "Received quote request from the website." } },
    },
    include: leadInclude,
  });
  await notifyNewLead(lead, "QUOTE_REQUEST");
  return res.status(201).json({ ok: true, number: lead.number });
}
