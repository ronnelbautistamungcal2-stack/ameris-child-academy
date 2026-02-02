import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true, recordedBy: true },
    });

    if (!activity) return res.status(404).json({ error: "Activity not found" });

    // Parent can only see their own child's activities
    if (
      session.user.role === "PARENT" &&
      activity.child.parentId !== session.user.id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(activity);
  }

  if (req.method === "DELETE") {
    const activity = await prisma.activityLog.findUnique({ where: { id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    // Only admin can delete activities; teachers cannot delete logs
    if (session.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only admins can delete activity logs" });
    }

    await prisma.activityLog.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  res.status(405).end();
}
