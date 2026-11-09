import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeParentFaqTopic } from "@/lib/parentFaqs";
import { ownsAccountDocument } from "@/lib/subscriberAccounts";

// Another account's question answers 404, like one that doesn't exist.
async function findOwned(id, session) {
  const faq = await prisma.parentFaq.findUnique({ where: { id } });
  if (!faq || !(await ownsAccountDocument(session.user.id, faq.subscriberAccountId))) return null;
  return faq;
}

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
    console.error("parent-faqs/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { id } = req.query;
  const faq = await findOwned(id, session);
  if (!faq) return res.status(404).json({ error: "Question not found" });
  if (!faq.published && session.user.role !== "ADMIN") {
    return res.status(404).json({ error: "Question not found" });
  }
  return res.status(200).json(faq);
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage parent questions" });
  }

  const { id } = req.query;
  const existing = await findOwned(id, session);
  if (!existing) return res.status(404).json({ error: "Question not found" });

  const { question, answer, topic, sortOrder, published, centerId } = req.body || {};

  const data = {};
  if (question !== undefined) {
    if (!String(question).trim()) {
      return res.status(400).json({ error: "question cannot be empty" });
    }
    data.question = String(question).trim();
  }
  if (answer !== undefined) {
    if (!String(answer).trim()) {
      return res.status(400).json({ error: "answer cannot be empty" });
    }
    data.answer = String(answer).trim();
  }
  if (topic !== undefined) data.topic = normalizeParentFaqTopic(topic);
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    data.sortOrder = Number(sortOrder);
  }
  if (published !== undefined) data.published = !!published;
  if (centerId !== undefined) {
    if (centerId && !(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    data.centerId = centerId || null;
  }

  const updated = await prisma.parentFaq.update({ where: { id }, data });
  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage parent questions" });
  }

  const { id } = req.query;
  const existing = await findOwned(id, session);
  if (!existing) return res.status(404).json({ error: "Question not found" });

  await prisma.parentFaq.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
