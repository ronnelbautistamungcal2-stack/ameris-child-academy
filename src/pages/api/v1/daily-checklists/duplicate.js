import { getSession, hasAccessToCenter } from "@/lib/auth";
import { splitChecklistPerAssignee } from "@/lib/dailyChecklistSplit";
import prisma from "@/lib/prisma";
import {
  buildDailyChecklistInclude,
  serializeDailyChecklist,
} from "@/lib/dailyChecklistInclude";

function cloneItemData(item, sortOrder) {
  return {
    sortOrder,
    title: item.title,
    description: item.description,
    frequency: item.frequency,
    repeatDays: item.repeatDays,
    monthlyDay: item.monthlyDay,
    monthlyWeek: item.monthlyWeek,
    monthlyWeekday: item.monthlyWeekday,
    oneTimeDate: item.oneTimeDate,
    lessonSource: item.lessonSource,
    lessonSlot: item.lessonSlot,
    lessonCategoryId: item.lessonCategoryId,
    lessonId: item.lessonId,
    policyDocumentId: item.policyDocumentId,
    policyLink: item.policyLink,
    mediaLink: item.mediaLink,
    directLink: item.directLink,
    directLinkLabel: item.directLinkLabel,
    taskTime: item.taskTime,
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!["ADMIN", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Only admins and coaches can duplicate checklists" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { id, title } = req.body || {};
  if (!id) return res.status(400).json({ error: "id is required" });

  const source = await prisma.dailyChecklist.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ taskTime: "asc" }, { sortOrder: "asc" }] },
      classrooms: true,
      assignees: true,
    },
  });
  if (!source) return res.status(404).json({ error: "Checklist not found" });
  if (session.user.role === "COACH" && !(await hasAccessToCenter(session.user.id, source.centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const nextTitle = String(title || "").trim() || `${source.title} (Copy)`;

  const created = await prisma.dailyChecklist.create({
    data: {
      centerId: source.centerId,
      classRoomId: source.classRoomId,
      classrooms: source.classrooms.length
        ? { create: source.classrooms.map((c) => ({ classRoomId: c.classRoomId })) }
        : undefined,
      assignedUserId: source.assignedUserId,
      assignees: source.assignees.length
        ? { create: source.assignees.map((a) => ({ userId: a.userId })) }
        : undefined,
      title: nextTitle,
      description: source.description,
      noClassroom: source.noClassroom,
      category: source.category,
      frequency: source.frequency,
      repeatDays: source.repeatDays,
      monthlyDay: source.monthlyDay,
      monthlyWeek: source.monthlyWeek,
      monthlyWeekday: source.monthlyWeekday,
      active: source.active,
      items: source.items.length
        ? { create: source.items.map((item, i) => cloneItemData(item, i)) }
        : undefined,
    },
    include: buildDailyChecklistInclude(),
  });

  const copyIds = await splitChecklistPerAssignee(created.id);
  return res.status(201).json({ ...serializeDailyChecklist(created), copyIds });
}
