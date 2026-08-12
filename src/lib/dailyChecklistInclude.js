import {
  getChecklistClassRoomIds,
  getChecklistClassRooms,
} from "@/lib/dailyChecklistClassrooms";
import {
  getChecklistAssignedUserIds,
  getChecklistAssignedUsers,
} from "@/lib/dailyChecklistAssignees";

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

export function buildDailyChecklistInclude(date) {
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
            termDays: true,
            lessonSlot: true,
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
          },
        },
        lessonCategory: {
          select: {
            id: true,
            name: true,
            ageRange: true,
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
    classRoom: { select: { id: true, name: true, ageRange: true } },
    classrooms: {
      orderBy: { classRoomId: "asc" },
      include: {
        classRoom: { select: { id: true, name: true, ageRange: true } },
      },
    },
    center: { select: { id: true, name: true } },
    assignedUser: { select: { id: true, name: true, email: true, role: true } },
    assignees: {
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    },
    ...(notesInclude ? { notes: notesInclude } : {}),
  };
}

export function serializeDailyChecklist(checklist) {
  const classRooms = getChecklistClassRooms(checklist);
  const classRoomIds = getChecklistClassRoomIds({
    ...checklist,
    classRooms,
  });
  const assignedUsers = getChecklistAssignedUsers(checklist);
  const assignedUserIds = getChecklistAssignedUserIds({
    ...checklist,
    assignedUsers,
  });
  const { classrooms, assignees, ...rest } = checklist;

  return {
    ...rest,
    classRoomId: checklist.classRoomId || classRoomIds[0] || null,
    classRoom: checklist.classRoom || classRooms[0] || null,
    classRoomIds,
    classRooms,
    assignedUserId: checklist.assignedUserId || assignedUserIds[0] || null,
    assignedUser: checklist.assignedUser || assignedUsers[0] || null,
    assignedUserIds,
    assignedUsers,
  };
}
