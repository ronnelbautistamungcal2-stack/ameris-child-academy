import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "PATCH") {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: "Not found" });
    if (notification.recipientId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", ["PATCH"]);
  res.status(405).end();
}
