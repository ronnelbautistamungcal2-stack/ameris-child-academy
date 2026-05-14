import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";

function todayDateString() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeScheduledItemId(value) {
  return String(value || "").replace(/^scheduled:/, "");
}

async function completeScheduledLessonItem({ res, session, role, itemId, date, notes, undo }) {
  if (!["ADMIN", "COACH", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Only teachers, coaches, and admins can complete scheduled lessons" });
  }

  const normalizedItemId = normalizeScheduledItemId(itemId);
  const item = await prisma.milestoneChecklistItem.findUnique({
    where: { id: normalizedItemId },
    include: {
      plan: {
        select: {
          centerId: true,
          period: true,
          periodStart: true,
          active: true,
        },
      },
    },
  });

  if (!item) return res.status(404).json({ error: "Scheduled lesson item not found" });
  if (!item.plan?.active || item.plan?.period !== "DAY") {
    return res.status(400).json({ error: "Only active daily lesson plans can be completed from the teacher checklist" });
  }

  if (normalizeDateInput(date) !== normalizeDateInput(item.plan.periodStart)) {
    return res.status(400).json({ error: "Scheduled lesson date does not match the lesson plan date" });
  }

  if (role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, item.plan.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  if (role === "TEACHER" && item.assignedToId && item.assignedToId !== session.user.id) {
    return res.status(403).json({ error: "This lesson is assigned to another staff member" });
  }

  if (role === "TEACHER" && normalizeDateInput(date) !== todayDateString()) {
    return res.status(403).json({
      error: "Teachers can only complete scheduled lessons for the current day",
    });
  }

  const completionDate = new Date(date);

  if (undo) {
    await prisma.milestoneChecklistStaffCompletion.deleteMany({
      where: {
        itemId: normalizedItemId,
        completedById: session.user.id,
        date: completionDate,
      },
    });
    return res.status(200).json({ undone: true });
  }

  const completion = await prisma.milestoneChecklistStaffCompletion.upsert({
    where: {
      itemId_completedById_date: {
        itemId: normalizedItemId,
        completedById: session.user.id,
        date: completionDate,
      },
    },
    update: { notes: notes || null, completedAt: new Date() },
    create: {
      itemId: normalizedItemId,
      completedById: session.user.id,
      date: completionDate,
      notes: notes || null,
    },
    include: {
      completedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(200).json(completion);
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH", "TEACHER", "OTHER_STAFF"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    const { itemId, date, notes, undo, source } = req.body || {};

    if (!itemId || !date) {
      return res.status(400).json({ error: "itemId and date are required" });
    }

    if (
      String(source || "").toUpperCase() === "SCHEDULED_LESSON" ||
      String(itemId || "").startsWith("scheduled:")
    ) {
      await completeScheduledLessonItem({
        res,
        session,
        role,
        itemId,
        date,
        notes,
        undo,
      });
      return;
    }

    // Verify access to the checklist's center
    const item = await prisma.dailyChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        checklist: {
          select: {
            centerId: true,
            classRoomId: true,
            category: true,
            assignedUserId: true,
          },
        },
      },
    });

    if (!item) return res.status(404).json({ error: "Item not found" });

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, item.checklist.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }
    if (
      role === "OTHER_STAFF" &&
      (item.checklist.classRoomId || item.checklist.category === "CLASSROOM")
    ) {
      return res.status(403).json({ error: "Other staff cannot complete classroom checklists" });
    }
    if (
      ["TEACHER", "OTHER_STAFF"].includes(role) &&
      item.checklist.assignedUserId &&
      item.checklist.assignedUserId !== session.user.id
    ) {
      return res.status(403).json({ error: "This checklist is assigned to another staff member" });
    }
    if (role === "TEACHER" && item.checklist.classRoomId) {
      const teacherClassIds = await getTeacherClassIds(session.user.id, item.checklist.centerId);
      if (!teacherClassIds.includes(item.checklist.classRoomId)) {
        return res.status(403).json({ error: "You do not have access to this classroom checklist" });
      }
    }

    if (
      ["TEACHER", "OTHER_STAFF"].includes(role) &&
      normalizeDateInput(date) !== todayDateString()
    ) {
      return res.status(403).json({
        error: "Teachers and other staff can only complete checklist items for the current day",
      });
    }

    const completionDate = new Date(date);

    if (undo) {
      // Remove completion
      await prisma.dailyChecklistCompletion.deleteMany({
        where: {
          itemId,
          completedById: session.user.id,
          date: completionDate,
        },
      });
      return res.status(200).json({ undone: true });
    }

    // Upsert completion
    const completion = await prisma.dailyChecklistCompletion.upsert({
      where: {
        itemId_completedById_date: {
          itemId,
          completedById: session.user.id,
          date: completionDate,
        },
      },
      update: { notes: notes || null, completedAt: new Date() },
      create: {
        itemId,
        completedById: session.user.id,
        date: completionDate,
        notes: notes || null,
      },
      include: {
        completedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(completion);
  }

  res.setHeader("Allow", ["POST"]);
  res.status(405).end();
}
