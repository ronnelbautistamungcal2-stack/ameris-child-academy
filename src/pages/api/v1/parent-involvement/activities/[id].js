import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const { id } = req.query;

  if (req.method === "PUT") {
    const { title, description, active } = req.body || {};
    const activity = await prisma.parentInvolvementActivity.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });
    return res.status(200).json(activity);
  }

  if (req.method === "DELETE") {
    await prisma.parentInvolvementActivity.update({
      where: { id },
      data: { active: false },
    });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  res.status(405).end();
}
