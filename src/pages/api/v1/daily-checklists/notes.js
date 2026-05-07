import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";

async function loadChecklist(checklistId) {
  return prisma.dailyChecklist.findUnique({
    where: { id: checklistId },
    select: {
      id: true,
      centerId: true,
      classRoomId: true,
      category: true,
      assignedUserId: true,
    },
  });
}

async function assertChecklistAccess(session, checklist) {
  const role = session.user.role;

  if (!checklist) {
    return { ok: false, status: 404, error: "Checklist not found" };
  }

  if (role !== "ADMIN") {
    const hasCenterScope = await hasAccessToCenter(session.user.id, checklist.centerId);
    if (!hasCenterScope) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  if (
    role === "OTHER_STAFF" &&
    (checklist.classRoomId || checklist.category === "CLASSROOM")
  ) {
    return {
      ok: false,
      status: 403,
      error: "Other staff cannot write notes for classroom checklists",
    };
  }

  if (
    ["TEACHER", "OTHER_STAFF"].includes(role) &&
    checklist.assignedUserId &&
    checklist.assignedUserId !== session.user.id
  ) {
    return {
      ok: false,
      status: 403,
      error: "This checklist is assigned to another staff member",
    };
  }

  if (role === "TEACHER" && checklist.classRoomId) {
    const teacherClassIds = await getTeacherClassIds(session.user.id, checklist.centerId);
    if (!teacherClassIds.includes(checklist.classRoomId)) {
      return {
        ok: false,
        status: 403,
        error: "You do not have access to this classroom checklist",
      };
    }
  }

  return { ok: true };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH", "TEACHER", "OTHER_STAFF"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { checklistId, date, notes } = req.body || {};
  if (!checklistId || !date) {
    return res.status(400).json({ error: "checklistId and date are required" });
  }

  const checklist = await loadChecklist(checklistId);
  const access = await assertChecklistAccess(session, checklist);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const noteDate = new Date(date);
  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";

  if (!trimmedNotes) {
    await prisma.dailyChecklistNote.deleteMany({
      where: {
        checklistId,
        createdById: session.user.id,
        date: noteDate,
      },
    });
    return res.status(200).json({ cleared: true });
  }

  const note = await prisma.dailyChecklistNote.upsert({
    where: {
      checklistId_createdById_date: {
        checklistId,
        createdById: session.user.id,
        date: noteDate,
      },
    },
    update: { notes: trimmedNotes },
    create: {
      checklistId,
      createdById: session.user.id,
      date: noteDate,
      notes: trimmedNotes,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(200).json({
    ...note,
    mine: true,
  });
}
