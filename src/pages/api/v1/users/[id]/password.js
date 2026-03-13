import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }

  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (session.user.id !== id && session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { currentPassword, newPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Non-admin users must verify current password
  if (session.user.role !== "ADMIN") {
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    const valid = await bcrypt.compare(String(currentPassword), user.password);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
  }

  const hashed = await bcrypt.hash(String(newPassword), 10);
  await prisma.user.update({
    where: { id },
    data: { password: hashed },
  });

  return res.status(200).json({ message: "Password updated successfully" });
}
