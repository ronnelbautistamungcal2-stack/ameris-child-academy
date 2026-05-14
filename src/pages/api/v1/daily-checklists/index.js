import { getSession, hasAccessToCenter } from "@/lib/auth";
import {
  canTeacherAccessChecklist,
  getChecklistClassRoomIds,
  getChecklistClassRooms,
  hasChecklistClassroomScope,
  normalizeChecklistClassRoomIds,
} from "@/lib/dailyChecklistClassrooms";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";
import {
  itemMatchesDate,
  normalizeChecklistFrequency,
  normalizeMonthlyDay,
  normalizeOneTimeDate,
  normalizeRepeatDays,
} from "@/lib/checklistSchedule";

const LESSON_SELECT = {
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
      passingCriteria: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      ageRange: true,
    },
  },
};

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatTaskTimeFromDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
          select: LESSON_SELECT,
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
    classrooms: {
      orderBy: { classRoomId: "asc" },
      include: {
        classRoom: { select: { id: true, name: true } },
      },
    },
    center: { select: { id: true, name: true } },
    assignedUser: { select: { id: true, name: true, email: true, role: true } },
    ...(notesInclude ? { notes: notesInclude } : {}),
  };
}

function serializeDailyChecklist(checklist) {
  const classRooms = getChecklistClassRooms(checklist);
  const classRoomIds = getChecklistClassRoomIds({
    ...checklist,
    classRooms,
  });
  const { classrooms, ...rest } = checklist;

  return {
    ...rest,
    classRoomId: checklist.classRoomId || classRoomIds[0] || null,
    classRoom: checklist.classRoom || classRooms[0] || null,
    classRoomIds,
    classRooms,
  };
}

async function validateChecklistClassRoomIds(centerId, classRoomIds) {
  if (!classRoomIds.length) return [];

  const rooms = await prisma.classRoom.findMany({
    where: {
      centerId,
      id: { in: classRoomIds },
    },
    select: { id: true },
  });

  if (rooms.length !== classRoomIds.length) {
    throw new Error("One or more selected classrooms are invalid for this center");
  }

  return classRoomIds;
}

function buildChecklistClassroomScopeData(classRoomIds) {
  return {
    classRoomId: classRoomIds[0] || null,
    classrooms: {
      deleteMany: {},
      ...(classRoomIds.length
        ? {
            create: classRoomIds.map((classRoomId) => ({ classRoomId })),
          }
        : {}),
    },
  };
}

function scheduledPlanToChecklist(plan) {
  const items = (plan.items || []).map((item) => ({
    id: item.id,
    source: "SCHEDULED_LESSON",
    sourcePlanId: plan.id,
    sortOrder: item.sortOrder,
    title: item.title || item.lesson?.title || item.lessonGoal?.title || "Scheduled lesson",
    description: item.notes || item.lessonGoal?.description || item.lesson?.description || null,
    lesson: item.lesson || null,
    lessonId: item.lessonId || null,
    lessonGoal: item.lessonGoal || null,
    lessonGoalId: item.lessonGoalId || null,
    policyDocument: item.policyDocument || null,
    policyDocumentId: item.policyDocumentId || null,
    directLink: item.url || null,
    directLinkLabel: item.url ? "Open scheduled resource" : null,
    policyLink: null,
    mediaLink: item.kind === "VIDEO" ? item.url || null : null,
    taskTime: formatTaskTimeFromDate(item.dueAt),
    completions: Array.isArray(item.staffCompletions)
      ? item.staffCompletions.map((completion) => ({
          id: completion.id,
          completedAt: completion.completedAt,
          completedBy: completion.completedBy,
        }))
      : [],
  }));

  return {
    id: `scheduled:${plan.id}`,
    source: "SCHEDULED_LESSON_PLAN",
    sourcePlanId: plan.id,
    title: plan.title || "Scheduled Lessons",
    description: plan.description || null,
    category: "CLASSROOM",
    frequency: "ONE_TIME",
    scheduleLabel: "Scheduled today",
    active: plan.active,
    classRoom: null,
    classRoomId: null,
    classRoomIds: [],
    classRooms: [],
    center: plan.center || null,
    centerId: plan.centerId,
    assignedUser: null,
    assignedUserId: null,
    notes: [],
    items,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

async function loadScheduledLessonChecklists({ centerId, date, role }) {
  if (!centerId || !date || !["ADMIN", "TEACHER"].includes(role)) return [];

  const day = parseDateOnly(date);
  if (!day) return [];

  const plans = await prisma.milestoneChecklistPlan.findMany({
    where: {
      centerId,
      active: true,
      period: "DAY",
      periodStart: day,
    },
    include: {
      center: { select: { id: true, name: true } },
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          lesson: { select: LESSON_SELECT },
          lessonGoal: {
            select: {
              id: true,
              lessonId: true,
              goalIndex: true,
              title: true,
              description: true,
              passingCriteria: true,
            },
          },
          policyDocument: {
            select: {
              id: true,
              title: true,
              url: true,
            },
          },
          staffCompletions: {
            where: { date: day },
            include: {
              completedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: [{ periodStart: "asc" }, { title: "asc" }],
    take: 50,
  });

  return plans
    .map(scheduledPlanToChecklist)
    .filter((plan) => (plan.items || []).length > 0);
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
    classRoomIds: normalizeChecklistClassRoomIds(body.classRoomIds, body.classRoomId),
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
  const frequency = normalizeChecklistFrequency(it.frequency);
  return {
    title: it.title,
    description: it.description || null,
    frequency,
    repeatDays: frequency === "WEEKLY" ? normalizeRepeatDays(it.repeatDays) : [],
    monthlyDay: frequency === "MONTHLY" ? normalizeMonthlyDay(it.monthlyDay) : null,
    oneTimeDate: frequency === "ONE_TIME" ? normalizeOneTimeDate(it.oneTimeDate) : null,
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
    if (classRoomId) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { classRoomId },
            { classrooms: { some: { classRoomId } } },
          ],
        },
      ];
    }

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

    const filtered = lists
      .map((list) => ({
        ...list,
        items: date
          ? (list.items || []).filter((item) => itemMatchesDate(item, date, list))
          : list.items,
      }))
      .filter((list) => {
        if (date && (!Array.isArray(list.items) || list.items.length === 0)) return false;

        if (role === "OTHER_STAFF") {
          if (hasChecklistClassroomScope(list) || list.category === "CLASSROOM") return false;
        }

        if (role === "TEACHER") {
          if (!canTeacherAccessChecklist(list, teacherClassIds)) {
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

    const routineLists = filtered.map((list) => ({
      ...serializeDailyChecklist(list),
      notes: Array.isArray(list.notes)
        ? list.notes.map((note) => ({
            ...note,
            mine: note.createdById === session.user.id,
          }))
        : [],
    }));

    const scheduledLessonLists =
      date && !classRoomId && (!category || category === "CLASSROOM")
        ? await loadScheduledLessonChecklists({ centerId, date, role })
        : [];

    return res.status(200).json([...routineLists, ...scheduledLessonLists]);
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

    let classRoomIds;
    try {
      classRoomIds = await validateChecklistClassRoomIds(
        normalized.centerId,
        normalized.classRoomIds,
      );
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const { classRoomIds: _classRoomIds, ...checklistData } = normalized;

    const created = await prisma.dailyChecklist.create({
      data: {
        ...checklistData,
        classRoomId: classRoomIds[0] || null,
        ...(classRoomIds.length
          ? {
              classrooms: {
                create: classRoomIds.map((classRoomId) => ({ classRoomId })),
              },
            }
          : {}),
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

    return res.status(201).json(serializeDailyChecklist(created));
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update checklists" });
    }

    const { id, active, items } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const existingChecklist = await prisma.dailyChecklist.findUnique({
      where: { id },
      select: { centerId: true },
    });
    if (!existingChecklist) {
      return res.status(404).json({ error: "Checklist not found" });
    }

    const data = {};
    applyChecklistPatch(data, req.body || {});
    if (active !== undefined) data.active = active;

    const hasClassroomScopePatch =
      Object.prototype.hasOwnProperty.call(req.body || {}, "classRoomIds") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "classRoomId");
    const nextCenterId = data.centerId || existingChecklist.centerId;

    if (hasClassroomScopePatch) {
      let classRoomIds;
      try {
        classRoomIds = await validateChecklistClassRoomIds(
          nextCenterId,
          normalizeChecklistClassRoomIds(req.body?.classRoomIds, req.body?.classRoomId),
        );
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      Object.assign(data, buildChecklistClassroomScopeData(classRoomIds));
    } else if (Object.prototype.hasOwnProperty.call(req.body || {}, "centerId")) {
      Object.assign(data, buildChecklistClassroomScopeData([]));
    }

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

    return res.status(200).json(serializeDailyChecklist(result));
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
