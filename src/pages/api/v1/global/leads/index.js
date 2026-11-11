import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { LEAD_STATUSES, leadInclude, nextLeadNumber, parseLeadInput } from "@/lib/leads";

/**
 * GET  /api/v1/global/leads?status=&q=  -> { leads, counts }
 * POST /api/v1/global/leads  { centerName, contactName, email, ... }  "+ Add Lead"
 * Global admin > Sales & Leads.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SALES_LEADS");
  if (!session) return undefined;

  if (req.method === "GET") {
    const status = String(req.query.status || "");
    const q = String(req.query.q || "").trim();
    const where = {
      ...(LEAD_STATUSES.some((s) => s.value === status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { centerName: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { number: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [leads, grouped] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
        select: {
          id: true,
          number: true,
          status: true,
          source: true,
          centerName: true,
          contactName: true,
          quoteNumber: true,
          followUpDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, 0]));
    for (const g of grouped) counts[g.status] = g._count._all;
    return res.status(200).json({ leads, counts });
  }

  if (req.method === "POST") {
    const parsed = parseLeadInput(req.body || {}, { create: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        number: await nextLeadNumber(),
        source: "MANUAL",
        activities: { create: { staffId: session.user.id, description: "Lead added." } },
      },
      include: leadInclude,
    });
    return res.status(201).json(lead);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
