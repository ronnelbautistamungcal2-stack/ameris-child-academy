import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage subscriptions" });
  }

  const { id } = req.query;

  if (req.method === "GET") {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { center: true },
    });
    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    return res.status(200).json(sub);
  }

  if (req.method === "PUT") {
    const { tier, active, expiresAt, paymentInfo } = req.body || {};
    const sub = await prisma.subscription.update({
      where: { id },
      data: {
        tier: tier ?? undefined,
        active: active !== undefined ? !!active : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        paymentInfo: paymentInfo ?? null,
      },
      include: { center: true },
    });
    return res.status(200).json(sub);
  }

  if (req.method === "DELETE") {
    await prisma.subscription.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}

