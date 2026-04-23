import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { startOfDay } from "@/lib/attendance-classroom";
import { teacherCanAccessChild } from "@/lib/teacherScope";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { childId } = req.body || {};
  if (!childId) return res.status(400).json({ error: "childId is required" });

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true, centerId: true, classRoomId: true },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });

  if (role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, child.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    if (role === "TEACHER") {
      const hasClassAccess = await teacherCanAccessChild(session.user.id, child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }
  }

  const day = startOfDay();
  const now = new Date();

  const existing = await prisma.attendance.findUnique({
    where: { childId_day: { childId: child.id, day } },
  });

  const record = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkedInAt: now,
          checkedOutAt: null,
          classRoomId:
            existing.classRoomId !== undefined && existing.classRoomId !== null
              ? existing.classRoomId
              : child.classRoomId || null,
        },
      })
    : await prisma.attendance.create({
        data: {
          childId: child.id,
          centerId: child.centerId,
          day,
          classRoomId: child.classRoomId || null,
          checkedInAt: now,
        },
      });

  return res.status(200).json(record);
}
