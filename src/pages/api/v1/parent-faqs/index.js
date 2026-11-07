import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { normalizeParentFaqTopic } from "@/lib/parentFaqs";
import { accountIdForUser, accountOwnedWhere } from "@/lib/subscriberAccounts";

/**
 * Centers a non-admin viewer belongs to: staff through their center memberships,
 * parents through the centers their children are enrolled in.
 */
async function viewerCenterIds(user) {
  const memberships = await prisma.centerUser.findMany({
    where: { userId: user.id },
    select: { centerId: true },
  });
  const ids = new Set(memberships.map((m) => m.centerId).filter(Boolean));

  if (user.role === "PARENT") {
    const children = await prisma.child.findMany({
      where: buildParentLinkedChildWhere(user.id),
      select: { centerId: true },
    });
    children.forEach((c) => c.centerId && ids.add(c.centerId));
  }

  return [...ids];
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const user = session.user;

    if (req.method === "GET") {
      const { centerId, topic } = req.query;
      // Only the viewer's own account's questions, whatever the role.
      let where = await accountOwnedWhere(user.id);
      if (user.role !== "ADMIN") {
        // Parents and staff see published questions for their own centers,
        // plus the ones published to every center.
        const centerIds = await viewerCenterIds(user);
        where = {
          ...where,
          published: true,
          OR: [
            { centerId: null },
            ...(centerIds.length ? [{ centerId: { in: centerIds } }] : []),
          ],
        };
      }
      if (centerId && user.role === "ADMIN" && !(await hasAccessToCenter(user.id, centerId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (centerId) where = { ...where, centerId };
      const normalizedTopic = normalizeParentFaqTopic(topic, "");
      if (normalizedTopic) where = { ...where, topic: normalizedTopic };

      const faqs = await prisma.parentFaq.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 200,
      });
      return res.status(200).json(faqs);
    }

    if (req.method === "POST") {
      if (user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can manage parent questions" });
      }
      const { question, answer, topic, sortOrder, published, centerId } = req.body || {};
      if (!String(question || "").trim() || !String(answer || "").trim()) {
        return res.status(400).json({ error: "question and answer are required" });
      }

      if (centerId && !(await hasAccessToCenter(user.id, centerId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const subscriberAccountId = await accountIdForUser(user.id);
      const created = await prisma.parentFaq.create({
        data: {
          ...(subscriberAccountId ? { subscriberAccountId } : {}),
          question: String(question).trim(),
          answer: String(answer).trim(),
          topic: normalizeParentFaqTopic(topic),
          sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
          published: published === undefined ? true : !!published,
          centerId: centerId || null,
        },
      });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("parent-faqs error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
