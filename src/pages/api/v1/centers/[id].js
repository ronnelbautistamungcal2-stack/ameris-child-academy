import bcrypt from "bcryptjs";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeSubscription } from "@/lib/subscriptions";
import { directorError, parseCenterInput } from "@/lib/centerSettings";
import { deleteCenterData } from "@/lib/centerDeletion.mjs";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  // Check access unless admin
  const hasAccess = await hasAccessToCenter(session.user.id, id);
  if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const center = await prisma.center.findUnique({
      where: { id },
      include: {
        users: true,
        classes: true,
        subscription: true,
        children: true,
        director: { select: { id: true, name: true, email: true } },
      },
    });
    if (!center) return res.status(404).json({ error: "Center not found" });
    return res.status(200).json({
      ...center,
      subscription: normalizeSubscription(center.subscription),
    });
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update centers" });
    }

    const parsed = parseCenterInput(req.body || {}, { partial: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const badDirector = await directorError(prisma, parsed.data.directorId);
    if (badDirector) return res.status(400).json({ error: badDirector });
    const center = await prisma.center.update({
      where: { id },
      data: parsed.data,
      include: { users: true, classes: true },
    });
    return res.status(200).json(center);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete centers" });
    }
    // The admin's password, typed twice, so a center isn't deleted by accident
    // (client request 2026-10-29).
    const { password, confirmPassword } = req.body || {};
    if (!password || !confirmPassword) return res.status(400).json({ error: "Enter your password twice to delete the center" });
    if (password !== confirmPassword) return res.status(400).json({ error: "The two passwords don't match" });
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
    if (!me?.password || !(await bcrypt.compare(String(password), me.password))) {
      return res.status(403).json({ error: "That password is not correct" });
    }

    try {
      // The shared center deletion (src/lib/centerDeletion.mjs).
      await prisma.$transaction((tx) => deleteCenterData(tx, id));
    } catch (err) {
      console.error("Failed to delete center:", err);
      return res.status(500).json({ error: "Failed to delete center" });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
