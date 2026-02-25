import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;

  if (req.method === "GET") {
    const archive = await prisma.progressArchive.findUnique({ where: { id } });
    if (!archive) return res.status(404).json({ error: "Archive not found" });

    if (session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, archive.centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(archive);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete archives" });
    }

    const archive = await prisma.progressArchive.findUnique({ where: { id } });
    if (!archive) return res.status(404).json({ error: "Archive not found" });

    await prisma.progressArchive.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  res.status(405).end();
}
