import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const { id } = req.query;

    if (req.method === "DELETE") {
      await prisma.teacherCommendation.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("teacher-commendations/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
