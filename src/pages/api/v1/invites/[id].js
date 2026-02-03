import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage invites" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid id" });
  }

  if (req.method === "PATCH") {
    const { active, expiresAt } = req.body || {};
    const data = {};
    if (typeof active === "boolean") data.active = active;
    if (expiresAt === null || typeof expiresAt === "string") {
      data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updated = await prisma.centerInvite.update({
      where: { id },
      data,
      include: { center: { select: { id: true, name: true } } },
    });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", ["PATCH"]);
  res.status(405).end();
}

