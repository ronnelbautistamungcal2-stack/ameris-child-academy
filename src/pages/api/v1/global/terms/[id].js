import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";

/**
 * GET /api/v1/global/terms/:id?q=  -> { document, acceptances: [...] }
 * Who accepted this version: name, email, account, role, date and time, IP
 * address and browser. Newest first, at most 1,000 (search narrows it).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const document = await prisma.termsDocument.findUnique({ where: { id: String(req.query.id || "") } });
  if (!document) return res.status(404).json({ error: "Terms not found" });
  const q = String(req.query.q || "").trim();
  const rows = await prisma.termsAcceptance.findMany({
    where: {
      documentId: document.id,
      ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { acceptedAt: "desc" },
    take: 1000,
  });
  const accountIds = [...new Set(rows.map((r) => r.subscriberAccountId).filter(Boolean))];
  const accounts = accountIds.length
    ? await prisma.subscriberAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, accountNumber: true, name: true } })
    : [];
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  return res.status(200).json({
    document,
    acceptances: rows.map((r) => ({
      id: r.id,
      name: r.user?.name || "",
      email: r.user?.email || "",
      account: r.subscriberAccountId ? byId[r.subscriberAccountId] || null : null,
      role: r.role,
      acceptedAt: r.acceptedAt,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
    })),
  });
}
