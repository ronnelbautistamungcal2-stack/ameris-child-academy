import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  // Check access unless admin
  if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, id);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const center = await prisma.center.findUnique({
      where: { id },
      include: {
        users: true,
        classes: true,
        subscription: true,
        children: true,
      },
    });
    if (!center) return res.status(404).json({ error: "Center not found" });
    return res.status(200).json(center);
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update centers" });
    }

    const { name, address } = req.body;
    const center = await prisma.center.update({
      where: { id },
      data: { name, address },
      include: { users: true, classes: true },
    });
    return res.status(200).json(center);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete centers" });
    }

    await prisma.center.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
