import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePolicyCategory } from "@/lib/policy-categories";
import { parseDocument } from "@/lib/policyDocuments";
import { ownsAccountDocument } from "@/lib/subscriberAccounts";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("policies/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Another account's document answers 404, like one that doesn't exist.
async function findOwned(id, session) {
  const doc = await prisma.policyDocument.findUnique({ where: { id } });
  if (!doc || !(await ownsAccountDocument(session.user.id, doc.subscriberAccountId))) return null;
  return doc;
}

async function handleGet(req, res, session) {
  const { id } = req.query;
  const doc = await findOwned(id, session);
  if (!doc) return res.status(404).json({ error: "Policy not found" });
  return res.status(200).json(doc);
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage policies" });
  }

  const { id } = req.query;
  const existing = await findOwned(id, session);
  if (!existing) return res.status(404).json({ error: "Policy not found" });

  // Edits send the fields that changed; check the document as it will be.
  const merged = { ...existing, ...(req.body || {}) };
  // Subscribers no longer receive documents (client 2026-10-02).
  merged.roles = (merged.roles || []).filter((role) => role !== "SUBSCRIBER");
  const parsed = parseDocument(merged, normalizePolicyCategory(merged.category));
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = parsed.data;
  if (data.centerId && data.centerId !== existing.centerId && !(await hasAccessToCenter(session.user.id, data.centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // A file that was replaced by a website (or the other way round) keeps url in step.
  if (req.body?.url === undefined && req.body?.websiteUrl !== undefined && existing.url === existing.websiteUrl) {
    data.url = data.websiteUrl || existing.url;
  }

  const updated = await prisma.policyDocument.update({ where: { id }, data });
  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage policies" });
  }

  const { id } = req.query;
  const existing = await findOwned(id, session);
  if (!existing) return res.status(404).json({ error: "Policy not found" });

  await prisma.policyDocument.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
