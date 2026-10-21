import { getSession } from "@/lib/auth";
import { classReportScope } from "@/lib/classReportAccess";
import prisma from "@/lib/prisma";

/** GET /api/v1/reports/classes — the classrooms the user can open a Class Performance Report for. */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const scope = await classReportScope(session.user);
    if (!scope) return res.status(403).json({ error: "Forbidden" });
    const classes = await prisma.classRoom.findMany({
      where: scope,
      select: {
        id: true,
        name: true,
        center: { select: { name: true } },
        teachers: { select: { teacher: { select: { name: true, email: true } } } },
      },
      orderBy: { name: "asc" },
    });
    return res.status(200).json(
      classes.map((c) => ({
        id: c.id,
        name: c.name,
        center: c.center?.name || "",
        teacher: c.teachers.map((t) => t.teacher.name || t.teacher.email).join(", "),
      })),
    );
  } catch (e) {
    console.error("report classes error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
