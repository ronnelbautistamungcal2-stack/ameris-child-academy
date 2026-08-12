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

export function normalizeChecklistAssignedUserIds(value, fallbackValue = null) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (value && typeof value === "object" && Array.isArray(value.assignedUserIds)) {
    return uniqueStrings(value.assignedUserIds);
  }
  return uniqueStrings([value || fallbackValue || ""]);
}

export function getChecklistAssignedUserIds(checklist) {
  const ids = [];

  if (Array.isArray(checklist?.assignedUserIds)) {
    ids.push(...checklist.assignedUserIds);
  }

  if (Array.isArray(checklist?.assignedUsers)) {
    for (const user of checklist.assignedUsers) {
      ids.push(user?.id);
    }
  }

  if (Array.isArray(checklist?.assignees)) {
    for (const assignment of checklist.assignees) {
      ids.push(assignment?.userId);
      ids.push(assignment?.user?.id);
    }
  }

  ids.push(checklist?.assignedUserId);

  return uniqueStrings(ids);
}

export function getChecklistAssignedUsers(checklist) {
  const ordered = [];
  const seen = new Set();

  function pushUser(user) {
    if (!user?.id || seen.has(user.id)) return;
    seen.add(user.id);
    ordered.push({
      id: user.id,
      name: user.name || user.email || user.id,
      email: user.email || null,
      role: user.role || null,
    });
  }

  if (Array.isArray(checklist?.assignedUsers)) {
    for (const user of checklist.assignedUsers) pushUser(user);
  }

  if (Array.isArray(checklist?.assignees)) {
    for (const assignment of checklist.assignees) {
      pushUser(assignment?.user || null);
    }
  }

  pushUser(checklist?.assignedUser || null);

  return ordered;
}

export function hasChecklistAssigneeScope(checklist) {
  return getChecklistAssignedUserIds(checklist).length > 0;
}

export function canUserBeAssignedChecklist(checklist, userId) {
  const scopedUserIds = getChecklistAssignedUserIds(checklist);
  if (!scopedUserIds.length) return true;
  return scopedUserIds.includes(userId);
}
