import { mapAgeRangeToGroup } from "@/lib/ageUtils";

export const LESSON_SOURCE_OPTIONS = [
  { value: "NONE", label: "No lesson" },
  { value: "FIXED", label: "Use one fixed lesson" },
  { value: "AUTO_SLOT", label: "Pull lesson automatically by slot" },
];

export const TERM_DAY_OPTIONS = Array.from({ length: 5 }, (_, index) => ({
  value: index + 1,
  label: `Day ${index + 1}`,
}));

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTextKey(value) {
  return normalizeText(value).toLowerCase();
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function normalizeLessonSource(value, fallbackLessonId = "", fallbackLessonSlot = "") {
  const normalized = normalizeText(value).toUpperCase();
  if (["NONE", "FIXED", "AUTO_SLOT"].includes(normalized)) return normalized;
  if (normalizeText(fallbackLessonId)) return "FIXED";
  if (normalizeText(fallbackLessonSlot)) return "AUTO_SLOT";
  return "NONE";
}

export function normalizeLessonSlot(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

export function normalizeTermDaySelections(value) {
  const source = Array.isArray(value) ? value : value == null ? [] : [value];
  const seen = new Set();
  const out = [];

  for (const raw of source) {
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1 || num > 31 || seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }

  return out.sort((left, right) => left - right);
}

export function formatTermDaysLabel(termDays) {
  const values = normalizeTermDaySelections(termDays);
  if (!values.length) return "";
  return values.map((value) => `Day ${value}`).join(", ");
}

export function resolveTermCalendarEntry(termCalendars, value) {
  const target = toDateOnly(value);
  if (!target) return null;

  const entries = Array.isArray(termCalendars) ? termCalendars : [];
  for (const entry of entries) {
    const startDate = toDateOnly(entry?.startDate);
    const endDate = toDateOnly(entry?.endDate);
    if (!startDate || !endDate) continue;
    if (target < startDate || target > endDate) continue;

    let termDay = null;
    if (isWeekday(target)) {
      let cursor = new Date(startDate);
      let count = 0;
      while (cursor <= target) {
        if (isWeekday(cursor)) count += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      termDay = count || null;
    }

    return {
      id: entry.id,
      term: normalizeText(entry.term),
      startDate,
      endDate,
      termDay,
    };
  }

  return null;
}

function buildAgeGroupKeys(classRooms) {
  const keys = new Set();

  for (const room of Array.isArray(classRooms) ? classRooms : []) {
    const ageKey = mapAgeRangeToGroup(room?.ageRange);
    if (ageKey) keys.add(ageKey);
  }

  return [...keys];
}

function lessonAgePriority(lesson, checklistAgeGroupKeys) {
  const ageKey = mapAgeRangeToGroup(lesson?.category?.ageRange);
  if (checklistAgeGroupKeys.length && ageKey && checklistAgeGroupKeys.includes(ageKey)) {
    return 0;
  }
  if (!ageKey) return 1;
  if (!checklistAgeGroupKeys.length) return 1;
  return 2;
}

export function resolveAutoLessonMatch({
  lessons,
  checklistClassRooms,
  lessonSlot,
  lessonCategoryId,
  term,
  termDay,
}) {
  const normalizedSlot = normalizeTextKey(lessonSlot);
  const normalizedTerm = normalizeTextKey(term);
  if (!normalizedSlot || !normalizedTerm || !Number(termDay)) return null;

  const checklistAgeGroupKeys = buildAgeGroupKeys(checklistClassRooms);
  const candidates = [];

  for (const lesson of Array.isArray(lessons) ? lessons : []) {
    if (normalizeTextKey(lesson?.lessonSlot) !== normalizedSlot) continue;
    if (lessonCategoryId && lesson?.category?.id !== lessonCategoryId) continue;

    const lessonTerm = normalizeTextKey(lesson?.term);
    if (normalizedTerm && lessonTerm && lessonTerm !== normalizedTerm) continue;
    if (normalizedTerm && !lessonTerm) continue;

    const termDays = normalizeTermDaySelections(lesson?.termDays);
    if (termDay && termDays.length && !termDays.includes(Number(termDay))) continue;
    if (termDay && !termDays.length) continue;

    candidates.push(lesson);
  }

  if (!candidates.length) return null;

  candidates.sort((left, right) => {
    const agePriority = lessonAgePriority(left, checklistAgeGroupKeys) - lessonAgePriority(right, checklistAgeGroupKeys);
    if (agePriority !== 0) return agePriority;

    const leftTitle = normalizeText(left?.title);
    const rightTitle = normalizeText(right?.title);
    const titleCompare = leftTitle.localeCompare(rightTitle);
    if (titleCompare !== 0) return titleCompare;

    return normalizeText(left?.id).localeCompare(normalizeText(right?.id));
  });

  return candidates[0] || null;
}
