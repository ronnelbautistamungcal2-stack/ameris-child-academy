function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function getPassingCriteria(goal) {
  if (!goal?.passingCriteria || Array.isArray(goal.passingCriteria)) return {};
  return typeof goal.passingCriteria === "object" ? goal.passingCriteria : {};
}

function splitResourceValues(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|\n|;)\s*/g)
    .map((entry) => normalizeSpaces(entry))
    .filter(Boolean);
}

function looksLikeResourceHref(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return false;
  return (
    raw.startsWith("/") ||
    raw.startsWith("./") ||
    raw.startsWith("../") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  );
}

function fileLabel(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";

  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(raw, "http://localhost");
    const name = url.pathname.split("/").filter(Boolean).pop();
    if (name) return decodeURIComponent(name);
  } catch {
    // Fall through to the raw value below.
  }

  return raw;
}

function collectGoalAttachments(goal, addResource) {
  const passingCriteria = getPassingCriteria(goal);
  const goalTitle =
    normalizeSpaces(goal?.title) || `Step ${goal?.goalIndex || ""}`.trim();

  for (const attachment of splitResourceValues(passingCriteria.lessonAttachment)) {
    addResource(attachment, goalTitle || "Lesson attachment");
  }

  for (const attachment of splitResourceValues(passingCriteria.resource)) {
    addResource(attachment, goalTitle || "Goal resource");
  }

  for (const attachment of splitResourceValues(passingCriteria.additionalResources)) {
    addResource(attachment, goalTitle || "Additional resource");
  }

  for (const attachment of splitResourceValues(passingCriteria.lessonImage)) {
    addResource(attachment, goalTitle || "Lesson image");
  }
}

export function collectChecklistLessonAttachments(lesson, lessonGoal = null) {
  const items = [];
  const seen = new Set();

  function addResource(href, labelPrefix = "") {
    const normalizedHref = normalizeSpaces(href);
    if (!normalizedHref || !looksLikeResourceHref(normalizedHref)) return;
    const key = normalizedHref.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      href: normalizedHref,
      label: labelPrefix ? `${labelPrefix}: ${fileLabel(normalizedHref)}` : fileLabel(normalizedHref),
    });
  }

  for (const mediaEntry of Array.isArray(lesson?.media) ? lesson.media : []) {
    addResource(mediaEntry, "Lesson file");
  }

  for (const goal of Array.isArray(lesson?.goals) ? lesson.goals : []) {
    collectGoalAttachments(goal, addResource);
  }

  if (lessonGoal) {
    collectGoalAttachments(lessonGoal, addResource);
  }

  return items;
}
