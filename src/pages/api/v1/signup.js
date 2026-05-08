import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { email, password, name, inviteCode } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || !inviteCode) {
    return res
      .status(400)
      .json({ error: "Email, password, and invite code are required" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const code = String(inviteCode).trim().replace(/\s+/g, "").toUpperCase();
  const invite = await prisma.centerInvite.findUnique({
    where: { code },
  });
  const expired = invite?.expiresAt ? new Date(invite.expiresAt) < new Date() : false;
  if (!invite || !invite.active || expired) {
    return res.status(400).json({ error: "Invalid or expired invite code" });
  }
  if (invite.role === "ADMIN") {
    return res.status(400).json({ error: "Invalid invite code" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name || null,
      password: passwordHash,
      mustChangePassword: false,
      role: invite.role,
      centers: {
        create: {
          center: { connect: { id: invite.centerId } },
          role: invite.role,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      centers: true,
      createdAt: true,
    },
  });

  return res.status(201).json(user);
}
