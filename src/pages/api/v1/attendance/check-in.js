import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { signIn, signOut } from "@/lib/attendanceSessions";
import { startOfDay } from "@/lib/attendance-classroom";
import { teacherCanAccessChild } from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import { editorInitials } from "@/lib/timeSheets";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  // Parents sign their own children in and out from the dashboard.
  // Coaches too, from the Student List (R24, client 2026-11-10).
  if (!["ADMIN", "COACH", "TEACHER", "PARENT"].includes(role)) {
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
    select: { id: true, centerId: true, classRoomId: true, parentId: true, guardians: { select: { guardianId: true } } },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });

  if (role === "PARENT") {
    if (!isChildLinkedToParent(child, session.user.id)) return res.status(403).json({ error: "Forbidden" });
  } else {
    const ok = await hasAccessToCenter(session.user.id, child.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    if (role === "TEACHER") {
      const hasClassAccess = await teacherCanAccessChild(session.user.id, child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }
  }

  const day = startOfDay();
  const now = new Date();
  // Time sheets show who signed the child in.
  const by = await editorInitials(prisma, session.user.id);

  const existing = await prisma.attendance.findUnique({
    where: { childId_day: { childId: child.id, day } },
  });

  // Each sign-in is its own session, so earlier ins and outs today stay on
  // the time sheet (client sheet 10-29 (8), row 15).
  const { day: record } = await prisma.$transaction(async (tx) => {
    if (existing && !existing.classRoomId && child.classRoomId) {
      await tx.attendance.update({ where: { id: existing.id }, data: { classRoomId: child.classRoomId } });
    }
    return signIn(
      tx,
      "child",
      { day: existing, createData: { childId: child.id, centerId: child.centerId, day, classRoomId: child.classRoomId || null } },
      now,
      by,
    );
  });

  return res.status(200).json(record);
}
