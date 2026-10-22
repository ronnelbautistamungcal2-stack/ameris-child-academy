import prisma from "@/lib/prisma";

// A checklist assigned to several people is kept as one copy per person
// (client request 2026-10-02), so one person's ticks don't show on another's
// list. The first assignee keeps the checklist; every other assignee gets a
// copy carrying their own ticks and notes. Returns the ids of all copies.

function itemCopy(item) {
  const { id, checklistId, createdAt, ...rest } = item;
  return rest;
}

export async function splitChecklistPerAssignee(checklistId) {
  const source = await prisma.dailyChecklist.findUnique({
    where: { id: checklistId },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      classrooms: true,
      assignees: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!source) return [];
  const [keep, ...extras] = source.assignees;
  if (!extras.length) {
    if (keep && source.assignedUserId !== keep.userId) {
      await prisma.dailyChecklist.update({ where: { id: checklistId }, data: { assignedUserId: keep.userId } });
    }
    return [checklistId];
  }

  const { id, items, classrooms, assignees, createdAt, updatedAt, ...fields } = source;
  const ids = [checklistId];
  await prisma.$transaction(async (tx) => {
    for (const extra of extras) {
      const copy = await tx.dailyChecklist.create({
        data: {
          ...fields,
          assignedUserId: extra.userId,
          classrooms: classrooms.length ? { create: classrooms.map((c) => ({ classRoomId: c.classRoomId })) } : undefined,
        },
      });
      ids.push(copy.id);
      for (const item of items) {
        const newItem = await tx.dailyChecklistItem.create({ data: { ...itemCopy(item), checklistId: copy.id } });
        await tx.dailyChecklistCompletion.updateMany({
          where: { itemId: item.id, completedById: extra.userId },
          data: { itemId: newItem.id },
        });
        await tx.dailyChecklistLinkVisit.updateMany({
          where: { itemId: item.id, userId: extra.userId },
          data: { itemId: newItem.id },
        });
      }
      await tx.dailyChecklistNote.updateMany({
        where: { checklistId, createdById: extra.userId },
        data: { checklistId: copy.id },
      });
      await tx.dailyChecklistChoice.updateMany({
        where: { checklistId, userId: extra.userId },
        data: { checklistId: copy.id },
      });
      await tx.dailyChecklistAssignee.update({ where: { id: extra.id }, data: { checklistId: copy.id } });
    }
    await tx.dailyChecklist.update({ where: { id: checklistId }, data: { assignedUserId: keep.userId } });
  }, { timeout: 30000 });
  return ids;
}
