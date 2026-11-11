import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { LEAD_STATUSES, generateQuote, leadInclude, leadQuote, parseLeadInput } from "@/lib/leads";

const statusLabel = (v) => LEAD_STATUSES.find((s) => s.value === v)?.label || v;

async function detail(id) {
  const lead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!lead) return null;
  // The price of the current choices (the saved quote is a snapshot).
  return { ...lead, liveQuote: await leadQuote(lead) };
}

/**
 * GET   /api/v1/global/leads/:id  -> lead with activities and liveQuote
 * PATCH /api/v1/global/leads/:id  { ...fields }  Save Changes (status changes logged)
 * POST  /api/v1/global/leads/:id  { note } adds to Activity History
 *                                 { generateQuote: true } prices it and saves the quote
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;
  const id = String(req.query.id || "");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  if (req.method === "GET") return res.status(200).json(await detail(id));

  if (req.method === "PATCH") {
    const parsed = parseLeadInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const data = parsed.data;
    const log = [];
    if (data.status && data.status !== lead.status) log.push(`Status changed to ${statusLabel(data.status)}.`);
    await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        ...(log.length ? { activities: { create: log.map((description) => ({ staffId: session.user.id, description })) } } : {}),
      },
    });
    return res.status(200).json(await detail(id));
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (body.generateQuote) {
      const out = await generateQuote(lead, session.user);
      if (out.error) return res.status(400).json({ error: out.error });
      return res.status(200).json(await detail(id));
    }
    const note = String(body.note || "").trim().slice(0, 2000);
    if (!note) return res.status(400).json({ error: "Write what happened" });
    await prisma.leadActivity.create({ data: { leadId: id, staffId: session.user.id, description: note } });
    return res.status(200).json(await detail(id));
  }

  res.setHeader("Allow", ["GET", "PATCH", "POST"]);
  return res.status(405).end();
}
