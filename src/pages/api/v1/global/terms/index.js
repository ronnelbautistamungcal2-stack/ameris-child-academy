import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { TERMS_KINDS } from "@/lib/terms";

/**
 * GET  /api/v1/global/terms
 *      { kinds: [{ value, label, help, versions: [{ id, version, title, body, publishedAt, acceptances, current }] }] }
 * POST /api/v1/global/terms { kind, version, title, body }  publish a new version
 *      (it is in force at once; login terms are asked again at next sign-in).
 * Global admin > Terms & Agreements (client 2026-11-11).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SETTINGS");
  if (!session) return undefined;

  if (req.method === "GET") {
    const docs = await prisma.termsDocument.findMany({
      orderBy: { publishedAt: "desc" },
      include: { _count: { select: { acceptances: true } } },
    });
    return res.status(200).json({
      kinds: TERMS_KINDS.map((k) => {
        const versions = docs.filter((d) => d.kind === k.value);
        return {
          ...k,
          versions: versions.map(({ _count, ...d }, i) => ({ ...d, acceptances: _count.acceptances, current: i === 0 })),
        };
      }),
    });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const kind = TERMS_KINDS.find((k) => k.value === body.kind)?.value;
    if (!kind) return res.status(400).json({ error: "Choose which terms these are" });
    const version = String(body.version || "").trim().slice(0, 40);
    const title = String(body.title || "").trim().slice(0, 200);
    const text = String(body.body || "").trim().slice(0, 200000);
    if (!version) return res.status(400).json({ error: "Enter a version (for example today's date)" });
    if (!title) return res.status(400).json({ error: "Enter a title" });
    if (text.length < 20) return res.status(400).json({ error: "Enter the text of the terms" });
    if (await prisma.termsDocument.findUnique({ where: { kind_version: { kind, version } } })) {
      return res.status(409).json({ error: `Version ${version} already exists; use a new version name` });
    }
    const created = await prisma.termsDocument.create({ data: { kind, version, title, body: text, createdById: session.user.id } });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
