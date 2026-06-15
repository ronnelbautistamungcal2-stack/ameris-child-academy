const CHILD_DOCUMENT_TYPES = [
  { field: "healthAssessmentDocuments", label: "Health Assessment" },
  { field: "enrollmentDocuments", label: "Enrollment Documents" },
  { field: "iefDocuments", label: "IEF" },
  { field: "immunizationDocuments", label: "Immunizations" },
  { field: "infantDocuments", label: "Infant Documents" },
  { field: "otherDocuments", label: "Other" },
];

function childFullName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function startOfToday(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
}

function startOfTomorrow(reference = new Date()) {
  const date = startOfToday(reference);
  date.setDate(date.getDate() + 1);
  return date;
}

function startOfWeek(dateLike) {
  const date = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function isDateOnlyMidnight(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false;
  return (
    value.getHours() === 0 &&
    value.getMinutes() === 0 &&
    value.getSeconds() === 0 &&
    value.getMilliseconds() === 0
  );
}

function normalizeBehaviorType(details) {
  const raw =
    details?.behaviorType ||
    details?.type ||
    details?.behavior ||
    details?.label ||
    "";
  const value = String(raw || "").trim();
  return value || "Behavior";
}

function parseBehaviorLevel(details) {
  const raw = details?.behaviorLevel ?? details?.level;
  const level = Number(raw);
  return Number.isFinite(level) ? level : null;
}

function buildFlag({
  flagKey,
  flagType,
  child,
  title,
  summary,
  triggeredAt,
  classRoomId = child?.classRoom?.id || child?.classRoomId || null,
  classRoomName = child?.classRoom?.name || null,
  details = {},
}) {
  return {
    flagKey,
    flagType,
    title,
    summary,
    triggeredAt: toIsoString(triggeredAt) || toIsoString(child?.createdAt) || new Date().toISOString(),
    child: {
      id: child?.id || "",
      name: childFullName(child),
    },
    center: {
      id: child?.center?.id || child?.centerId || "",
      name: child?.center?.name || "",
    },
    classRoom: classRoomId
      ? {
          id: classRoomId,
          name: classRoomName || classRoomId,
        }
      : null,
    details,
  };
}

function createOccurrenceRow(activity) {
  return {
    id: activity.id,
    title: activity.notes || "Behavior log",
    subtitle: toIsoString(activity.createdAt),
  };
}

export function createChildFlagSnapshot(flag) {
  return {
    flagKey: flag.flagKey,
    flagType: flag.flagType,
    title: flag.title,
    summary: flag.summary,
    triggeredAt: flag.triggeredAt,
    child: flag.child || null,
    center: flag.center || null,
    classRoom: flag.classRoom || null,
    details: flag.details || {},
  };
}

export function hydrateChildFlagFromSnapshot(review) {
  const snapshot =
    review?.snapshot && typeof review.snapshot === "object" ? review.snapshot : {};
  return {
    flagKey: review?.flagKey || snapshot.flagKey || "",
    flagType: String(snapshot.flagType || "FLAG"),
    title: String(snapshot.title || "Closed child flag"),
    summary: String(snapshot.summary || ""),
    triggeredAt: toIsoString(snapshot.triggeredAt) || toIsoString(review?.createdAt),
    child: snapshot.child || { id: review?.childId || "", name: "Child" },
    center: snapshot.center || { id: review?.centerId || "", name: "" },
    classRoom: snapshot.classRoom || null,
    details: snapshot.details && typeof snapshot.details === "object" ? snapshot.details : {},
  };
}

export function filterChildFlags(items, filters = {}) {
  const childId = filters.childId || "";
  const classRoomId = filters.classRoomId || "";
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (childId && item?.child?.id !== childId) return false;
    if (classRoomId) {
      if (classRoomId === "__unassigned__") {
        if (item?.classRoom?.id) return false;
      } else if (item?.classRoom?.id !== classRoomId) {
        return false;
      }
    }

    const triggeredAt = item?.triggeredAt ? new Date(item.triggeredAt) : null;
    if (from && (!triggeredAt || Number.isNaN(triggeredAt.getTime()) || triggeredAt < from)) {
      return false;
    }
    if (to) {
      const inclusiveTo = new Date(to);
      inclusiveTo.setDate(inclusiveTo.getDate() + 1);
      if (!triggeredAt || Number.isNaN(triggeredAt.getTime()) || triggeredAt >= inclusiveTo) {
        return false;
      }
    }

    return true;
  });
}

export function sortChildFlags(items, status = "open") {
  const list = [...(Array.isArray(items) ? items : [])];
  if (status === "closed") {
    return list.sort((left, right) => {
      const leftDate = new Date(left?.closedAt || left?.triggeredAt || 0).getTime();
      const rightDate = new Date(right?.closedAt || right?.triggeredAt || 0).getTime();
      return rightDate - leftDate;
    });
  }

  return list.sort((left, right) => {
    const leftDate = new Date(left?.triggeredAt || 0).getTime();
    const rightDate = new Date(right?.triggeredAt || 0).getTime();
    if (rightDate !== leftDate) return rightDate - leftDate;
    return String(left?.child?.name || "").localeCompare(String(right?.child?.name || ""));
  });
}

export function buildActiveChildFlags({
  children = [],
  activities = [],
  milestonePlans = [],
  completions = [],
  now = new Date(),
}) {
  const flags = [];
  const todayStart = startOfToday(now);
  const tomorrowStart = startOfTomorrow(now);

  const childById = new Map(children.map((child) => [child.id, child]));
  const plansByCenterId = new Map();
  for (const plan of milestonePlans) {
    const list = plansByCenterId.get(plan.centerId) || [];
    list.push(plan);
    plansByCenterId.set(plan.centerId, list);
  }

  const completedKeys = new Set(
    (Array.isArray(completions) ? completions : [])
      .filter((completion) => completion?.completedAt)
      .map((completion) => `${completion.childId}:${completion.itemId}`),
  );

  for (const child of children) {
    if (!child) continue;

    if (String(child.allergies || "").trim()) {
      flags.push(
        buildFlag({
          flagKey: `allergy:${child.id}`,
          flagType: "ALLERGY",
          child,
          title: "Allergy on file",
          summary: String(child.allergies).trim(),
          triggeredAt: child.createdAt,
          details: {
            fields: [
              { label: "Child", value: childFullName(child) },
              { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
              { label: "Allergies", value: String(child.allergies).trim() },
            ],
          },
        }),
      );
    }

    if (!child.birthDate) {
      flags.push(
        buildFlag({
          flagKey: `missing-dob:${child.id}`,
          flagType: "MISSING_DOB",
          child,
          title: "Missing date of birth",
          summary: `${childFullName(child)} does not have a date of birth on file.`,
          triggeredAt: child.createdAt,
          details: {
            fields: [
              { label: "Child", value: childFullName(child) },
              { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
              { label: "Issue", value: "Date of birth is missing." },
            ],
          },
        }),
      );
    }

    if (!child.classRoomId) {
      flags.push(
        buildFlag({
          flagKey: `missing-classroom:${child.id}`,
          flagType: "MISSING_CLASSROOM",
          child,
          title: "Missing classroom",
          summary: `${childFullName(child)} is not assigned to a classroom.`,
          triggeredAt: child.createdAt,
          details: {
            fields: [
              { label: "Child", value: childFullName(child) },
              { label: "Issue", value: "Classroom assignment is missing." },
            ],
          },
        }),
      );
    }

    for (const documentType of CHILD_DOCUMENT_TYPES) {
      const docs = Array.isArray(child[documentType.field]) ? child[documentType.field] : [];
      docs.forEach((doc, index) => {
        const expirationDate = doc?.expirationDate ? new Date(doc.expirationDate) : null;
        if (!expirationDate || Number.isNaN(expirationDate.getTime())) return;
        if (expirationDate >= todayStart) return;

        const docIdentity =
          doc?.url ||
          doc?.originalName ||
          `${documentType.field}:${index}:${toIsoString(expirationDate)}`;

        flags.push(
          buildFlag({
            flagKey: `expired-document:${child.id}:${documentType.field}:${docIdentity}`,
            flagType: "OUTDATED_DOCUMENT",
            child,
            title: "Outdated document",
            summary: `${documentType.label} expired ${expirationDate.toLocaleDateString()}.`,
            triggeredAt: expirationDate,
            details: {
              fields: [
                { label: "Child", value: childFullName(child) },
                { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
                { label: "Document", value: doc?.documentType || doc?.originalName || documentType.label },
                { label: "Expires", value: expirationDate.toLocaleDateString() },
              ],
            },
          }),
        );
      });
    }

    const plans = plansByCenterId.get(child.centerId) || [];
    for (const plan of plans) {
      for (const item of Array.isArray(plan.items) ? plan.items : []) {
        const dueDate = item?.dueAt ? new Date(item.dueAt) : new Date(plan.periodStart);
        if (Number.isNaN(dueDate.getTime())) continue;

        let isOverdue = false;
        if (isDateOnlyMidnight(dueDate)) {
          isOverdue = dueDate < todayStart;
        } else {
          isOverdue = dueDate < tomorrowStart;
        }

        if (!isOverdue) continue;
        if (completedKeys.has(`${child.id}:${item.id}`)) continue;

        flags.push(
          buildFlag({
            flagKey: `steps-overdue:${child.id}:${item.id}`,
            flagType: "BEHIND_STEPS",
            child,
            title: "Behind on steps",
            summary: `${item.title || "Checklist item"} is overdue.`,
            triggeredAt: dueDate,
            details: {
              fields: [
                { label: "Child", value: childFullName(child) },
                { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
                { label: "Plan", value: plan.title || "Milestone checklist" },
                { label: "Item", value: item.title || "Checklist item" },
                { label: "Due", value: dueDate.toLocaleString() },
              ],
              notes: item?.notes || "",
            },
          }),
        );
      }
    }
  }

  const behaviorRepeatBuckets = new Map();

  for (const activity of activities) {
    const child = childById.get(activity?.childId);
    if (!child) continue;

    if (activity.type === "INCIDENT") {
      flags.push(
        buildFlag({
          flagKey: `incident:${activity.id}`,
          flagType: "INCIDENT",
          child,
          title: "Incident logged",
          summary: activity.notes || "An incident was logged for this child.",
          triggeredAt: activity.createdAt,
          details: {
            fields: [
              { label: "Child", value: childFullName(child) },
              { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
              {
                label: "Recorded By",
                value: activity.recordedBy?.name || activity.recordedBy?.email || "Unknown",
              },
              { label: "Logged", value: new Date(activity.createdAt).toLocaleString() },
            ],
            notes: activity.notes || "",
          },
        }),
      );
      continue;
    }

    if (activity.type !== "BEHAVIOR") continue;

    const details = activity?.details && typeof activity.details === "object" ? activity.details : {};
    const behaviorLevel = parseBehaviorLevel(details);
    const behaviorType = normalizeBehaviorType(details);

    if (behaviorLevel !== null && behaviorLevel >= 3) {
      flags.push(
        buildFlag({
          flagKey: `behavior-high:${activity.id}`,
          flagType: "BEHAVIOR_LEVEL_HIGH",
          child,
          title: `Level ${behaviorLevel} behavior logged`,
          summary: behaviorType,
          triggeredAt: activity.createdAt,
          details: {
            fields: [
              { label: "Child", value: childFullName(child) },
              { label: "Classroom", value: child.classRoom?.name || "Unassigned" },
              { label: "Behavior Type", value: behaviorType },
              { label: "Level", value: String(behaviorLevel) },
              {
                label: "Recorded By",
                value: activity.recordedBy?.name || activity.recordedBy?.email || "Unknown",
              },
              { label: "Logged", value: new Date(activity.createdAt).toLocaleString() },
            ],
            notes: activity.notes || "",
          },
        }),
      );
    }

    if (behaviorLevel === 2) {
      const weekStart = startOfWeek(activity.createdAt);
      const weekKey = weekStart ? weekStart.toISOString().slice(0, 10) : "unknown-week";
      const normalizedType = behaviorType.toLowerCase();
      const bucketKey = `${activity.childId}:${normalizedType}:${weekKey}`;
      const bucket = behaviorRepeatBuckets.get(bucketKey) || {
        child,
        behaviorType,
        weekStart,
        activities: [],
      };
      bucket.activities.push(activity);
      behaviorRepeatBuckets.set(bucketKey, bucket);
    }
  }

  for (const bucket of behaviorRepeatBuckets.values()) {
    if (bucket.activities.length < 3) continue;
    const sortedActivities = [...bucket.activities].sort(
      (left, right) => new Date(left.createdAt) - new Date(right.createdAt),
    );
    const latest = sortedActivities[sortedActivities.length - 1];
    const weekStart = bucket.weekStart;
    const weekLabel = weekStart ? weekStart.toLocaleDateString() : "this week";

    flags.push(
      buildFlag({
        flagKey: `behavior-repeat:${bucket.child.id}:${bucket.behaviorType.toLowerCase()}:${weekStart ? weekStart.toISOString().slice(0, 10) : "unknown-week"}`,
        flagType: "BEHAVIOR_REPEAT",
        child: bucket.child,
        title: "Repeated level 2 behavior",
        summary: `${bucket.behaviorType} logged ${sortedActivities.length} times during the week of ${weekLabel}.`,
        triggeredAt: latest.createdAt,
        details: {
          fields: [
            { label: "Child", value: childFullName(bucket.child) },
            { label: "Classroom", value: bucket.child.classRoom?.name || "Unassigned" },
            { label: "Behavior Type", value: bucket.behaviorType },
            { label: "Occurrences", value: String(sortedActivities.length) },
            { label: "Week Of", value: weekLabel },
          ],
          items: sortedActivities.map(createOccurrenceRow),
        },
      }),
    );
  }

  return flags;
}
