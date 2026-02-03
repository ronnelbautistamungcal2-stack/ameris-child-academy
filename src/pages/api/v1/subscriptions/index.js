import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage subscriptions" });
  }

  if (req.method === "GET") {
    const subs = await prisma.subscription.findMany({
      include: { center: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(subs);
  }

  if (req.method === "POST") {
    const { centerId, tier, active, expiresAt, paymentInfo } = req.body || {};
    if (!centerId || !tier) {
      return res.status(400).json({ error: "centerId and tier are required" });
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) return res.status(404).json({ error: "Center not found" });

    const sub = await prisma.subscription.upsert({
      where: { centerId },
      create: {
        centerId,
        tier,
        active: active !== undefined ? !!active : true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        paymentInfo: paymentInfo ?? null,
      },
      update: {
        tier,
        active: active !== undefined ? !!active : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        paymentInfo: paymentInfo ?? null,
      },
      include: { center: true },
    });

    return res.status(200).json(sub);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

