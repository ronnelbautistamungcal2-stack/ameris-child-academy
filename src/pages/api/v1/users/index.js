import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

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
    const { email, name, password, role, centerId, dob, hireDate, aboutMe, pictureUrl } = req.body;
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
        dob: parseOptionalDate(dob),
        hireDate: parseOptionalDate(hireDate),
        aboutMe: aboutMe ? String(aboutMe).slice(0, 5000) : null,
        pictureUrl: pictureUrl ? String(pictureUrl).slice(0, 2000) : null,
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
