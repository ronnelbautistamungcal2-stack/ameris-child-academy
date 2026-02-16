import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;
  const { centerId } = req.query;

  if (req.method === "GET") {
    // Admin sees all; others see templates targeted to their role and accessible centers.
    let where = {};
    if (user.role !== "ADMIN") {
      where = { active: true, targetRole: user.role };
      if (centerId) {
        if (user.role !== "PARENT") {
          const ok = await hasAccessToCenter(user.id, centerId);
          if (!ok) return res.status(403).json({ error: "Forbidden" });
        }
        // Include center-specific and global templates for scoped center views.
        where = { ...where, OR: [{ centerId }, { centerId: null }] };
      }
    } else if (centerId) {
      where = { centerId };
    }

    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.status(200).json(templates);
  }

  if (req.method === "POST") {
    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create form templates" });
    }

    const { title, description, targetRole, schema, centerId: cId, active } = req.body || {};
    if (!title || !targetRole) {
      return res.status(400).json({ error: "title and targetRole are required" });
    }

    const created = await prisma.formTemplate.create({
      data: {
        title,
        description: description || null,
        targetRole,
        schema: schema ?? null,
        centerId: cId || null,
        active: active ?? true,
      },
    });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
