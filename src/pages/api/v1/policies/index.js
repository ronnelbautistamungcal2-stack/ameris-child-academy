import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePolicyCategory } from "@/lib/policy-categories";
import { parseDocument } from "@/lib/policyDocuments";
import { userRoles } from "@/lib/roles";

/**
 * GET  /api/v1/policies?category=POLICY|RESOURCE[&centerId=]
 *      Admins see every document; everyone else the active ones for any of
 *      their roles.
 * POST /api/v1/policies { category, title, url?, websiteUrl?, roles[], ... }  (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;
  const { centerId, category } = req.query;

  if (req.method === "GET") {
    let where = user.role === "ADMIN" ? {} : { roles: { hasSome: userRoles(user) }, active: true };
    if (centerId) {
      if (user.role !== "ADMIN") {
        const ok = await hasAccessToCenter(user.id, centerId);
        if (!ok && user.role !== "PARENT") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      where = { ...where, centerId };
    }
    const normalizedCategory = normalizePolicyCategory(category, "");
    if (normalizedCategory) {
      where = { ...where, category: normalizedCategory };
    }

    const docs = await prisma.policyDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.status(200).json(docs);
  }

  if (req.method === "POST") {
    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can manage policies" });
    }
    const parsed = parseDocument(req.body || {}, normalizePolicyCategory(req.body?.category));
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const created = await prisma.policyDocument.create({ data: parsed.data });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
