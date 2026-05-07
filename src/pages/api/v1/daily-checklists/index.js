import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";
import {
  checklistMatchesDate,
  normalizeMonthlyDay,
  normalizeRepeatDays,
} from "@/lib/checklistSchedule";

function buildCompletionInclude(date) {
  if (!date) return false;
  return {
    where: { date: new Date(date) },
    include: {
      completedBy: { select: { id: true, name: true, email: true } },
    },
  };
}

function buildNotesInclude(date) {
  if (!date) return false;
  return {
    where: { date: new Date(date) },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  };
}

function buildDailyChecklistInclude(date) {
  const completionInclude = buildCompletionInclude(date);
  const notesInclude = buildNotesInclude(date);

  return {
    items: {
      orderBy: [{ taskTime: "asc" }, { sortOrder: "asc" }],
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            description: true,
            media: true,
            term: true,
            reference: true,
            goals: {
              orderBy: { goalIndex: "asc" },
              select: {
                id: true,
                goalIndex: true,
                title: true,
                description: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                ageRange: true,
              },
            },
          },
        },
        policyDocument: {
          select: {
            id: true,
            title: true,
            url: true,
          },
        },
        ...(completionInclude ? { completions: completionInclude } : {}),
      },
    },
    classRoom: { select: { id: true, name: true } },
    center: { select: { id: true, name: true } },
    assignedUser: { select: { id: true, name: true, email: true, role: true } },
    ...(notesInclude ? { notes: notesInclude } : {}),
  };
}

function normalizeChecklistPayload(body = {}) {
  const normalizedFrequency = ["DAILY", "WEEKLY", "MONTHLY"].includes(
    String(body.frequency || "").toUpperCase(),
  )
    ? String(body.frequency).toUpperCase()
    : "DAILY";

  const repeatDays =
    normalizedFrequency === "WEEKLY"
      ? normalizeRepeatDays(body.repeatDays)
      : [];
  const monthlyDay =
    normalizedFrequency === "MONTHLY"
      ? normalizeMonthlyDay(body.monthlyDay)
      : null;

  return {
    title: body.title,
    description: body.description || null,
    centerId: body.centerId,
    classRoomId: body.classRoomId || null,
    assignedUserId: body.assignedUserId || null,
    category: ["OPENING", "CLOSING", "HEALTH_SAFETY", "CLEANING", "MEALS", "CLASSROOM", "OTHER"].includes(body.category)
      ? body.category
      : "OTHER",
    frequency: normalizedFrequency,
    repeatDays,
    monthlyDay,
  };
}

function applyChecklistPatch(data, body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    data.title = body.title;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    data.description = body.description || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "centerId")) {
    data.centerId = body.centerId;
  }
  if (Object.prototype.hasOwnProperty.call(body, "classRoomId")) {
    data.classRoomId = body.classRoomId || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "assignedUserId")) {
    data.assignedUserId = body.assignedUserId || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "category")) {
    data.category = ["OPENING", "CLOSING", "HEALTH_SAFETY", "CLEANING", "MEALS", "CLASSROOM", "OTHER"].includes(body.category)
      ? body.category
      : "OTHER";
  }
  if (
    Object.prototype.hasOwnProperty.call(body, "frequency") ||
    Object.prototype.hasOwnProperty.call(body, "repeatDays") ||
    Object.prototype.hasOwnProperty.call(body, "monthlyDay")
  ) {
    const frequency = ["DAILY", "WEEKLY", "MONTHLY"].includes(
      String(body.frequency || data.frequency || "").toUpperCase(),
    )
      ? String(body.frequency || data.frequency).toUpperCase()
      : "DAILY";
    data.frequency = frequency;
    data.repeatDays =
      frequency === "WEEKLY"
        ? normalizeRepeatDays(body.repeatDays)
        : [];
    data.monthlyDay =
      frequency === "MONTHLY"
        ? normalizeMonthlyDay(body.monthlyDay)
        : null;
  }
}

function serializeItem(it, sortOrder) {
  return {
    title: it.title,
    description: it.description || null,
    lessonId: it.lessonId || null,
    policyDocumentId: it.policyDocumentId || null,
    policyLink: it.policyLink || null,
    mediaLink: it.mediaLink || null,
    directLink: it.directLink || null,
    directLinkLabel: it.directLinkLabel || null,
    taskTime: it.taskTime || null,
    sortOrder,
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH", "TEACHER", "OTHER_STAFF"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, category, classRoomId, date } = req.query;

    if (centerId && role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    let where = role === "ADMIN" && !date ? {} : { active: true };
    if (centerId) where.centerId = centerId;
    if (category) where.category = category;
    if (classRoomId) where.classRoomId = classRoomId;

    if (!centerId && role !== "ADMIN") {
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      });
      where.centerId = { in: memberships.map((m) => m.centerId) };
    }

    const teacherClassIds =
      role === "TEACHER" ? await getTeacherClassIds(session.user.id, centerId) : [];
    const include = buildDailyChecklistInclude(date);

    const lists = await prisma.dailyChecklist.findMany({
      where,
      include,
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    const filtered = lists.filter((list) => {
      if (date && !checklistMatchesDate(list, date)) return false;

      if (role === "OTHER_STAFF") {
        if (list.classRoomId || list.category === "CLASSROOM") return false;
      }

      if (role === "TEACHER") {
        if (list.classRoomId && !teacherClassIds.includes(list.classRoomId)) {
          return false;
        }
      }

      if (["TEACHER", "OTHER_STAFF"].includes(role)) {
        if (list.assignedUserId && list.assignedUserId !== session.user.id) {
          return false;
        }
      }

      return true;
    });

    return res.status(200).json(
      filtered.map((list) => ({
        ...list,
        notes: Array.isArray(list.notes)
          ? list.notes.map((note) => ({
              ...note,
              mine: note.createdById === session.user.id,
            }))
          : [],
      })),
    );
  }

  if (req.method === "POST") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create checklists" });
    }

    const { items } = req.body || {};
    const normalized = normalizeChecklistPayload(req.body || {});

    if (!normalized.title || !normalized.centerId) {
      return res.status(400).json({ error: "title and centerId are required" });
    }

    const created = await prisma.dailyChecklist.create({
      data: {
        ...normalized,
        items: Array.isArray(items)
          ? {
              create: items
                .filter((it) => it && it.title)
                .map((it, i) => serializeItem(it, i)),
            }
          : undefined,
      },
      include: buildDailyChecklistInclude(),
    });

    return res.status(201).json(created);
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update checklists" });
    }

    const { id, active, items } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const data = {};
    applyChecklistPatch(data, req.body || {});
    if (active !== undefined) data.active = active;

    const updated = await prisma.dailyChecklist.update({
      where: { id },
      data,
      include: buildDailyChecklistInclude(),
    });

    // If items provided, sync them
    if (Array.isArray(items)) {
      // Delete removed items
      const existingIds = items.filter((it) => it.id).map((it) => it.id);
      await prisma.dailyChecklistItem.deleteMany({
        where: { checklistId: id, id: { notIn: existingIds } },
      });

      // Upsert items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.id) {
          await prisma.dailyChecklistItem.update({
            where: { id: it.id },
            data: serializeItem(it, i),
          });
        } else if (it.title) {
          await prisma.dailyChecklistItem.create({
            data: { checklistId: id, ...serializeItem(it, i) },
          });
        }
      }
    }

    // Re-fetch with updated items
    const result = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: buildDailyChecklistInclude(),
    });

    return res.status(200).json(result);
  }

  if (req.method === "DELETE") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete checklists" });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    await prisma.dailyChecklist.delete({ where: { id } });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  res.status(405).end();
}
