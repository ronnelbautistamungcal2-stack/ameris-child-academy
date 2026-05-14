function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    result.push(next);
  }

  return result;
}

export function normalizeChecklistClassRoomIds(value, fallbackValue = null) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (value && typeof value === "object" && Array.isArray(value.classRoomIds)) {
    return uniqueStrings(value.classRoomIds);
  }
  return uniqueStrings([value || fallbackValue || ""]);
}

export function getChecklistClassRoomIds(checklist) {
  const ids = [];

  if (Array.isArray(checklist?.classRoomIds)) {
    ids.push(...checklist.classRoomIds);
  }

  if (Array.isArray(checklist?.classRooms)) {
    for (const room of checklist.classRooms) {
      ids.push(room?.id);
    }
  }

  if (Array.isArray(checklist?.classrooms)) {
    for (const assignment of checklist.classrooms) {
      ids.push(assignment?.classRoomId);
      ids.push(assignment?.classRoom?.id);
    }
  }

  ids.push(checklist?.classRoomId);

  return uniqueStrings(ids);
}

export function getChecklistClassRooms(checklist) {
  const ordered = [];
  const seen = new Set();

  function pushRoom(room) {
    if (!room?.id || seen.has(room.id)) return;
    seen.add(room.id);
    ordered.push({ id: room.id, name: room.name || room.id });
  }

  if (Array.isArray(checklist?.classRooms)) {
    for (const room of checklist.classRooms) pushRoom(room);
  }

  if (Array.isArray(checklist?.classrooms)) {
    for (const assignment of checklist.classrooms) {
      pushRoom(assignment?.classRoom || null);
    }
  }

  pushRoom(checklist?.classRoom || null);

  return ordered;
}

export function hasChecklistClassroomScope(checklist) {
  return getChecklistClassRoomIds(checklist).length > 0;
}

export function canTeacherAccessChecklist(checklist, teacherClassIds = []) {
  const scopedClassIds = getChecklistClassRoomIds(checklist);
  if (!scopedClassIds.length) return true;
  return scopedClassIds.some((id) => teacherClassIds.includes(id));
}
