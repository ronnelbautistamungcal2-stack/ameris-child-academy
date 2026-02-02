import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage users" });
  }

  if (req.method === "GET") {
    // List all users (admin only)
    const users = await prisma.user.findMany({
      include: { centers: true, children: true },
    });
    return res.status(200).json(users);
  }

  if (req.method === "POST") {
    // Create new user
    const { email, name, password, role, centerId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
        role: role || "PARENT",
        centers: centerId
          ? {
              create: {
                center: { connect: { id: centerId } },
                role: role || "PARENT",
              },
            }
          : undefined,
      },
      include: { centers: true },
    });

    return res.status(201).json(user);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
