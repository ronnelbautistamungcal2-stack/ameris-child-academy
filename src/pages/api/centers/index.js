import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    // List centers (filtered by user's access if not admin)
    let centers;
    if (session.user.role === "ADMIN") {
      centers = await prisma.center.findMany({
        include: { users: true, classes: true, subscription: true },
      });
    } else if (session.user.role === "PARENT") {
      const children = await prisma.child.findMany({
        where: { parentId: session.user.id },
        select: { centerId: true },
      });
      const centerIds = [...new Set(children.map((c) => c.centerId))];
      centers = centerIds.length
        ? await prisma.center.findMany({
            where: { id: { in: centerIds } },
            include: { users: true, classes: true, subscription: true },
          })
        : [];
    } else {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          centers: {
            include: {
              center: {
                include: { users: true, classes: true, subscription: true },
              },
            },
          },
        },
      });
      centers = (user?.centers || []).map((c) => c.center);
    }
    return res.status(200).json(centers);
  }

  if (req.method === "POST") {
    // Create center (admin only)
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create centers" });
    }

    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const center = await prisma.center.create({
      data: { name, address },
      include: { users: true },
    });

    return res.status(201).json(center);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
