import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function makeCode() {
  // 10 chars, easy to type
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage invites" });
  }

  if (req.method === "GET") {
    const invites = await prisma.centerInvite.findMany({
      include: {
        center: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.status(200).json(invites);
  }

  if (req.method === "POST") {
    const { centerId, role, expiresAt, code } = req.body || {};
    if (!centerId || !role) {
      return res.status(400).json({ error: "centerId and role are required" });
    }
    if (role === "ADMIN") {
      return res.status(400).json({ error: "Admin invites are not allowed" });
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) return res.status(404).json({ error: "Center not found" });

    const normalized = code ? normalizeCode(code) : makeCode();
    if (!normalized || normalized.length < 6) {
      return res.status(400).json({ error: "Invalid code" });
    }

    const invite = await prisma.centerInvite.create({
      data: {
        centerId,
        role,
        code: normalized,
        active: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.user.id,
      },
      include: { center: { select: { id: true, name: true } } },
    });
    return res.status(201).json(invite);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

