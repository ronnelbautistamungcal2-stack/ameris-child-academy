import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    // Get user by ID
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { centers: true, children: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json(user);
  }

  if (req.method === "PUT") {
    // Update user
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, email, role } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (role && session.user.role === "ADMIN") updateData.role = role;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { centers: true },
    });

    return res.status(200).json(user);
  }

  if (req.method === "DELETE") {
    // Delete user
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete users" });
    }

    await prisma.user.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
