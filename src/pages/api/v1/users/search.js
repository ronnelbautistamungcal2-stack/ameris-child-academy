import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { q, limit: limitStr } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.status(200).json([]);
  }

  const limit = Math.min(parseInt(limitStr) || 10, 25);
  const search = String(q).trim();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      pictureUrl: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return res.status(200).json(users);
}
