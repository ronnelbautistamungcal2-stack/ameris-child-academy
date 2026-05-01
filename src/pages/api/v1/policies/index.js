import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;
  const { centerId } = req.query;

  if (req.method === "GET") {
    let where = user.role === "ADMIN" ? {} : { roles: { has: user.role } };
    if (centerId) {
      if (user.role !== "ADMIN") {
        const ok = await hasAccessToCenter(user.id, centerId);
        if (!ok && user.role !== "PARENT") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      where = { ...where, centerId };
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
    const { title, description, url, roles, centerId: cId } = req.body || {};
    if (!title || !url || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: "title, url, and roles[] are required" });
    }
    const created = await prisma.policyDocument.create({
      data: {
        title,
        description: description || null,
        url,
        roles,
        centerId: cId || null,
      },
    });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
