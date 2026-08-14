import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "ACCOMPLISHMENT",
  "INCIDENT",
  "TOILETING",
  "OTHER",
];

const QUICK_TYPE_OPTIONS = ["MEAL", "NAP", "DIAPER_CHANGE", "TOILETING", "ACTIVITY", "BEHAVIOR", "ACCOMPLISHMENT", "INCIDENT", "OTHER"];

const TYPE_META = {
  INCIDENT: { label: "Incident", color: "#b91c1c", tint: "#fee2e2", icon: "⚠️" },
  DIAPER_CHANGE: { label: "Diaper Change", color: "#7c3aed", tint: "#f3e8ff", icon: "💧" },
  NAP: { label: "Nap", color: "#4338ca", tint: "#e0e7ff", icon: "😴" },
  BOTTLE: { label: "Bottle", color: "#0369a1", tint: "#e0f2fe", icon: "🍼" },
  MEAL: { label: "Meal", color: "#b45309", tint: "#fef3c7", icon: "🍽️" },
  SNACK: { label: "Snack", color: "#047857", tint: "#d1fae5", icon: "🍎" },
  ACTIVITY: { label: "Activity", color: "#be185d", tint: "#fce7f3", icon: "🎨" },
  TASK_CHECKLIST: { label: "Task / Checklist", color: "#0f766e", tint: "#ccfbf1", icon: "✅" },
  BEHAVIOR: { label: "Citizenship", color: "#c2410c", tint: "#ffedd5", icon: "🤝" },
  ACCOMPLISHMENT: { label: "Accomplishment", color: "#15803d", tint: "#dcfce7", icon: "🏆" },
  TOILETING: { label: "Toileting", color: "#0891b2", tint: "#cffafe", icon: "🚽" },
  OTHER: { label: "Grade", color: "#475569", tint: "#e2e8f0", icon: "📝" },
};

const MEAL_OCCASIONS = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "AM_SNACK", label: "AM snack" },
  { value: "LUNCH", label: "Lunch" },
  { value: "PM_SNACK", label: "PM snack" },
  { value: "DINNER", label: "Dinner" },
  { value: "EVENING_SNACK", label: "Evening snack" },
];

const PORTION_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "MOST", label: "Most" },
  { value: "SOME", label: "Some" },
  { value: "NONE", label: "None" },
];

const BOTTLE_PORTION_OPTIONS = [
  { value: "FULL", label: "Full" },
  { value: "MOST", label: "Most" },
  { value: "HALF", label: "Half" },
  { value: "SOME", label: "Some" },
  { value: "NONE", label: "None" },
];

const BEHAVIOR_TYPE_OPTIONS = [
  { value: "PHYSICAL_VIOLENCE", label: "Physical violence" },
  { value: "VIRTUE", label: "Virtue" },
  { value: "RESPECT", label: "Respect" },
  { value: "OBEDIENCE", label: "Obedience" },
  { value: "OTHER", label: "Other" },
];

const BEHAVIOR_LEVEL_OPTIONS = ["1", "2", "3", "4"];

const DIAPER_TYPE_OPTIONS = [
  { value: "BM", label: "BM" },
  { value: "W", label: "W" },
  { value: "D", label: "D" },
];

const TOILETING_TYPE_OPTIONS = [
  { value: "SUCCESS", label: "Success" },
  { value: "TRIED", label: "Tried" },
  { value: "ACCIDENT", label: "Accident" },
];

const ASSESSMENT_DOMAINS = [
  {
    key: "cognitive",
    label: "Cognitive Development",
    description: "Problem-solving, curiosity, focus & memory",
    badge: "CG",
    tint: "#dbeafe",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  },
  {
    key: "social",
    label: "Social-Emotional",
    description: "Sharing, empathy, self-regulation & cooperation",
    badge: "SE",
    tint: "#e0f2fe",
    color: "#0369a1",
    borderColor: "#bae6fd",
  },
  {
    key: "physical",
    label: "Physical Development",
    description: "Motor skills, coordination & physical activity",
    badge: "PD",
    tint: "#dcfce7",
    color: "#15803d",
    borderColor: "#bbf7d0",
  },
  {
    key: "language",
    label: "Language & Communication",
    description: "Vocabulary, expression, listening & comprehension",
    badge: "LC",
    tint: "#fef3c7",
    color: "#b45309",
    borderColor: "#fde68a",
  },
  {
    key: "creative",
    label: "Creative Expression",
    description: "Art, music, imaginative play & self-expression",
    badge: "CE",
    tint: "#ffe4e6",
    color: "#be123c",
    borderColor: "#fecdd3",
  },
];

const RUBRIC_LEVELS = [
  { value: 1, label: "Emerging", background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" },
  { value: 2, label: "Developing", background: "#e0f2fe", color: "#0c4a6e", borderColor: "#7dd3fc" },
  { value: 3, label: "Proficient", background: "#dcfce7", color: "#166534", borderColor: "#86efac" },
  { value: 4, label: "Advanced", background: "#dbeafe", color: "#1e3a8a", borderColor: "#93c5fd" },
];

const MANAGED_DETAIL_KEYS = new Set([
  "kind",
  "grade",
  "domains",
  "domainAvg",
  "media",
  "photos",
  "time",
  "startTime",
  "endTime",
  "meal",
  "mealType",
  "quantity",
  "diaperType",
  "behaviorType",
  "behaviorLevel",
  "toiletingType",
]);

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function supportsBehaviorDetails(type) {
  return type === "BEHAVIOR";
}

function supportsToiletingDetails(type) {
  return type === "TOILETING";
}

function supportsDirectGrade(type) {
  return type === "OTHER";
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function fullChildName(child) {
  return `${child?.firstName || ""}${child?.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function childInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function dayLabel(dateKey) {
  if (!dateKey) return "Unknown date";
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function groupActivitiesByDay(activities) {
  const groups = new Map();
  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const key = Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(activity);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, label: dayLabel(key === "unknown" ? "" : key), items }));
}

function relativeTime(dateStr) {
  const now = new Date();
  const value = new Date(dateStr);
  if (Number.isNaN(value.getTime())) return "-";
  const diffMs = now - value;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: value.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDateTimeInput() {
  return toLocalDateTimeInput(new Date());
}

function formatClock(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateLike, timeValue) {
  const base = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(base.getTime())) return null;
  const [hoursRaw, minutesRaw] = String(timeValue || "").split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return new Date(base);
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function defaultActivityFields(nextType) {
  return {
    napStartTime: "",
    napEndTime: "",
    mealType: nextType === "SNACK" ? "AM_SNACK" : "BREAKFAST",
    quantity: "ALL",
    bottleQuantity: "FULL",
    diaperType: "W",
    behaviorType: "OTHER",
    behaviorLevel: "1",
    toiletingType: "SUCCESS",
  };
}

function createEmptyForm(nextType = "MEAL", createdAt = defaultDateTimeInput()) {
  return {
    type: nextType,
    notes: "",
    createdAt,
    fields: defaultActivityFields(nextType),
    dailyGrade: "",
    domainScores: {},
    mediaUrls: [],
    extraDetailsText: "",
  };
}

function applyTypeChange(form, nextType) {
  const defaults = defaultActivityFields(nextType);
  const currentFields = asObject(form?.fields);
  return {
    ...form,
    type: nextType,
    fields: {
      ...defaults,
      napStartTime: nextType === "NAP" ? currentFields.napStartTime || "" : "",
      napEndTime: nextType === "NAP" ? currentFields.napEndTime || "" : "",
      mealType:
        ["MEAL", "SNACK"].includes(nextType)
          ? currentFields.mealType || defaults.mealType
          : defaults.mealType,
      quantity:
        ["MEAL", "SNACK"].includes(nextType)
          ? currentFields.quantity || defaults.quantity
          : defaults.quantity,
      bottleQuantity:
        nextType === "BOTTLE"
          ? currentFields.bottleQuantity || defaults.bottleQuantity
          : defaults.bottleQuantity,
      diaperType:
        nextType === "DIAPER_CHANGE"
          ? currentFields.diaperType || defaults.diaperType
          : defaults.diaperType,
      behaviorType:
        supportsBehaviorDetails(nextType)
          ? currentFields.behaviorType || defaults.behaviorType
          : defaults.behaviorType,
      behaviorLevel:
        supportsBehaviorDetails(nextType)
          ? currentFields.behaviorLevel || defaults.behaviorLevel
          : defaults.behaviorLevel,
      toiletingType:
        supportsToiletingDetails(nextType)
          ? currentFields.toiletingType || defaults.toiletingType
          : defaults.toiletingType,
    },
  };
}

function extractActivityMediaUrls(activity) {
  const details = asObject(activity?.details);
  const raw = [...arr(details.media), ...arr(details.photos)];
  return [...new Set(
    raw
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && typeof item.url === "string") {
          return item.url.trim();
        }
        return "";
      })
      .filter(Boolean),
  )];
}

function extractDailyGrade(details) {
  const safe = asObject(details);
  if (safe.kind !== "DAILY_GRADE" || safe.domains) return "";
  const grade = Number(safe.grade);
  return Number.isFinite(grade) ? String(grade) : "";
}

function extractDomainScores(details) {
  const safe = asObject(details);
  return safe.kind === "DAILY_GRADE" && safe.domains ? safe.domains : {};
}

function stripManagedDetails(details) {
  const safe = asObject(details);
  return Object.fromEntries(
    Object.entries(safe).filter(([key]) => !MANAGED_DETAIL_KEYS.has(key)),
  );
}

function buildFormFromActivity(activity) {
  const details = asObject(activity?.details);
  const nextType = activity?.type || "OTHER";
  const extraDetails = stripManagedDetails(details);
  return {
    type: nextType,
    notes: activity?.notes || "",
    createdAt: toLocalDateTimeInput(activity?.createdAt) || defaultDateTimeInput(),
    fields: {
      ...defaultActivityFields(nextType),
      napStartTime: details.startTime || "",
      napEndTime: details.endTime || "",
      mealType: details.mealType || (nextType === "SNACK" ? "AM_SNACK" : "BREAKFAST"),
      quantity: details.quantity || "ALL",
      bottleQuantity: details.quantity || "FULL",
      diaperType: details.diaperType || "W",
      behaviorType: details.behaviorType || "OTHER",
      behaviorLevel: details.behaviorLevel || "1",
      toiletingType: details.toiletingType || "SUCCESS",
    },
    dailyGrade: extractDailyGrade(details),
    domainScores: extractDomainScores(details),
    mediaUrls: extractActivityMediaUrls(activity),
    extraDetailsText: Object.keys(extraDetails).length ? JSON.stringify(extraDetails, null, 2) : "",
  };
}

function parseExtraDetails(extraDetailsText) {
  const trimmed = String(extraDetailsText || "").trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extra details must be a JSON object.");
  }
  return parsed;
}

function getFormValidationMessage(form) {
  const baseDate = form?.createdAt ? new Date(form.createdAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return "Select a valid date and time.";
  }

  try {
    parseExtraDetails(form?.extraDetailsText);
  } catch (error) {
    return error?.message || "Extra details must be valid JSON.";
  }

  const fields = asObject(form?.fields);
  if (form?.type === "NAP" && fields.napStartTime && fields.napEndTime) {
    const start = combineDateAndTime(baseDate, fields.napStartTime);
    const end = combineDateAndTime(baseDate, fields.napEndTime);
    if (!start || !end || end.getTime() < start.getTime()) {
      return "Nap end time must be after the start time.";
    }
  }

  if (supportsDirectGrade(form?.type) && !Object.keys(asObject(form?.domainScores)).length) {
    const gradeNum = form?.dailyGrade === "" ? null : Number(form?.dailyGrade);
    if (!Number.isFinite(gradeNum)) {
      return "Enter a grade from 0 to 10.";
    }
    if (gradeNum < 0 || gradeNum > 10) {
      return "Grade must be between 0 and 10.";
    }
  }

  return "";
}

function buildPayloadFromForm(form) {
  const baseDate = form?.createdAt ? new Date(form.createdAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Select a valid date and time.");
  }

  const extraDetails = parseExtraDetails(form?.extraDetailsText);
  const fields = asObject(form?.fields);
  const hasDomainScores = Object.keys(asObject(form?.domainScores)).length > 0;
  const gradeNum = form?.dailyGrade === "" ? null : Number(form?.dailyGrade);
  const hasDirectGrade =
    supportsDirectGrade(form?.type) &&
    form?.dailyGrade !== "" &&
    Number.isFinite(gradeNum);
  const payloadType = hasDomainScores || supportsDirectGrade(form?.type) ? "OTHER" : form?.type || "OTHER";
  const entryTime = formatClock(baseDate);
  const mediaUrls = [...new Set(arr(form?.mediaUrls).filter(Boolean))];

  let details = { ...extraDetails };

  if (hasDomainScores) {
    const scores = Object.values(form.domainScores).filter((value) => Number(value) > 0);
    const avg = scores.length
      ? Math.round((scores.reduce((sum, value) => sum + Number(value), 0) / scores.length) * 10) / 10
      : null;
    const grade = avg !== null ? Math.round((avg / 4) * 5) : null;
    details.kind = "DAILY_GRADE";
    details.grade = grade;
    details.domains = { ...form.domainScores };
    details.domainAvg = avg;
  } else if (hasDirectGrade) {
    details.kind = "DAILY_GRADE";
    details.grade = gradeNum;
  }

  if (payloadType === "NAP") {
    details.time = fields.napStartTime || fields.napEndTime || entryTime;
    details.startTime = fields.napStartTime || "";
    details.endTime = fields.napEndTime || "";
  } else if (["MEAL", "SNACK"].includes(payloadType)) {
    const options =
      payloadType === "SNACK"
        ? MEAL_OCCASIONS.filter((option) => option.value.includes("SNACK"))
        : MEAL_OCCASIONS;
    const mealType = fields.mealType || (payloadType === "SNACK" ? "AM_SNACK" : "BREAKFAST");
    const selectedOption = options.find((option) => option.value === mealType);
    details.time = entryTime;
    details.meal = selectedOption?.label || mealType;
    details.mealType = mealType;
    details.quantity = fields.quantity || "ALL";
  } else if (payloadType === "BOTTLE") {
    details.time = entryTime;
    details.quantity = fields.bottleQuantity || "FULL";
  } else if (payloadType === "DIAPER_CHANGE") {
    details.time = entryTime;
    details.diaperType = fields.diaperType || "W";
  } else if (payloadType === "BEHAVIOR") {
    details.time = entryTime;
    details.behaviorType = fields.behaviorType || "OTHER";
    details.behaviorLevel = fields.behaviorLevel || "1";
  } else if (payloadType === "TOILETING") {
    details.time = entryTime;
    details.toiletingType = fields.toiletingType || "SUCCESS";
  } else if (!supportsDirectGrade(form?.type)) {
    details.time = entryTime;
  }

  if (mediaUrls.length) details.media = mediaUrls;
  else delete details.media;
  delete details.photos;

  const createdAt =
    payloadType === "NAP" && (fields.napStartTime || fields.napEndTime)
      ? combineDateAndTime(baseDate, fields.napStartTime || fields.napEndTime)
      : new Date(baseDate);

  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    throw new Error("Select a valid date and time.");
  }

  if (!Object.keys(details).length) details = null;

  return {
    type: payloadType,
    notes: String(form?.notes || "").trim() || null,
    details,
    createdAt: createdAt.toISOString(),
  };
}

function formatActivitySummary(activity) {
  const details = asObject(activity?.details);
  const mediaCount = extractActivityMediaUrls(activity).length;

  if (details.kind === "DAILY_GRADE" && details.domains) {
    const domainSummary = Object.entries(details.domains)
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    return `${domainSummary || "Assessment logged"}${mediaCount ? ` | ${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : ""}`;
  }
  if (details.kind === "DAILY_GRADE" && details.grade != null) {
    return `Grade ${details.grade}/10${mediaCount ? ` | ${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : ""}`;
  }
  if (activity?.type === "NAP") {
    if (details.startTime || details.endTime) {
      return `Rest ${details.startTime || "?"} - ${details.endTime || "?"}`;
    }
    return mediaCount ? `${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : "Rest entry";
  }
  if (["MEAL", "SNACK"].includes(activity?.type)) {
    const parts = [details.meal || details.mealType || "", details.quantity || ""].filter(Boolean);
    if (mediaCount) parts.push(`${mediaCount} photo${mediaCount === 1 ? "" : "s"}`);
    return parts.join(" | ") || "Meal entry";
  }
  if (activity?.type === "BOTTLE") {
    const parts = [details.quantity || ""].filter(Boolean);
    if (mediaCount) parts.push(`${mediaCount} photo${mediaCount === 1 ? "" : "s"}`);
    return parts.join(" | ") || "Bottle entry";
  }
  if (activity?.type === "DIAPER_CHANGE") {
    return `${details.diaperType || "Routine"}${mediaCount ? ` | ${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : ""}`;
  }
  if (activity?.type === "BEHAVIOR") {
    const parts = [details.behaviorType || "", details.behaviorLevel ? `Level ${details.behaviorLevel}` : ""].filter(Boolean);
    if (mediaCount) parts.push(`${mediaCount} photo${mediaCount === 1 ? "" : "s"}`);
    return parts.join(" | ") || "Citizenship entry";
  }
  if (activity?.type === "INCIDENT") {
    return mediaCount ? `${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : "Incident entry";
  }
  if (activity?.type === "TOILETING") {
    const label = TOILETING_TYPE_OPTIONS.find((option) => option.value === details.toiletingType)?.label;
    return `${label || "Toileting"}${mediaCount ? ` | ${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : ""}`;
  }
  return mediaCount ? `${mediaCount} photo${mediaCount === 1 ? "" : "s"}` : "Logged entry";
}

function hasAssessment(activity) {
  return asObject(activity?.details).kind === "DAILY_GRADE";
}

function buildActivityMetaPills(activity) {
  const details = asObject(activity?.details);
  const mediaCount = extractActivityMediaUrls(activity).length;
  const pills = [];

  if (activity?.recordedBy?.name || activity?.recordedBy?.email) {
    pills.push({
      label: activity.recordedBy?.name || activity.recordedBy?.email,
      tone: "slate",
    });
  }

  if (hasAssessment(activity)) {
    pills.push({
      label: details.domains ? "Domain Assessment" : "Grade",
      tone: "sky",
    });
  }

  if (mediaCount) {
    pills.push({
      label: `${mediaCount} photo${mediaCount === 1 ? "" : "s"}`,
      tone: "emerald",
    });
  }

  return pills;
}

function composerHelperText(type) {
  if (type === "NAP") {
    return "Nap entries can capture a start time, an end time, or both.";
  }
  if (["MEAL", "SNACK"].includes(type)) {
    return "Meal entries capture the time, meal type, quantity, and description.";
  }
  if (type === "BOTTLE") {
    return "Bottle entries capture the time, quantity, and description.";
  }
  if (type === "DIAPER_CHANGE") {
    return "Diaper entries capture the time, diaper type, and description.";
  }
  if (type === "BEHAVIOR") {
    return "Citizenship entries capture type, level, time, and description.";
  }
  if (type === "ACCOMPLISHMENT") {
    return "Accomplishment entries capture the time and a description of what was achieved.";
  }
  if (type === "INCIDENT") {
    return "Incident entries capture the time and description.";
  }
  if (type === "TOILETING") {
    return "Toileting entries capture the time, type (success, tried, or accident), and description.";
  }
  if (supportsDirectGrade(type)) {
    return "Grade entries capture a 0-10 score and description.";
  }
  return "Activity entries capture the time and description.";
}

function composerDescriptionPlaceholder(type) {
  if (type === "NAP") return "Add a short rest-time note";
  if (["MEAL", "SNACK", "BOTTLE"].includes(type)) return "Add meal or feeding details";
  if (type === "INCIDENT") return "Describe the incident";
  return "Add a short note about the activity";
}

function getAssessmentOverall(domainScores) {
  const entries = Object.entries(asObject(domainScores)).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return null;

  const average = entries.reduce((sum, [, value]) => sum + Number(value), 0) / entries.length;
  const level = RUBRIC_LEVELS.find((item) => item.value === Math.round(average));

  return {
    label: level ? level.label : `${average.toFixed(1)}/4`,
    count: entries.length,
    average,
  };
}

function fileToBase64(file, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      try {
        reader.abort();
      } catch {}
      reject(new Error(`File read timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    reader.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to read file"));
    };

    reader.onload = () => {
      clearTimeout(timer);
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      if (commaIndex === -1) {
        reject(new Error("Invalid file encoding"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };

    reader.onabort = () => {
      clearTimeout(timer);
      reject(new Error("File read aborted"));
    };

    reader.readAsDataURL(file);
  });
}

async function uploadFilesToUrls(files) {
  const uploadedUrls = [];
  const issues = [];
  for (const file of Array.from(files || [])) {
    if (Number(file?.size || 0) > MAX_PHOTO_BYTES) {
      issues.push(`${file.name} exceeds 10MB`);
      continue;
    }
    try {
      const dataBase64 = await fileToBase64(file, 12000);
      const result = await apiJson("/api/v1/uploads", {
        method: "POST",
        timeoutMs: 25000,
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });
      if (result?.url) uploadedUrls.push(result.url);
      else issues.push(`${file.name} upload did not return a URL`);
    } catch {
      issues.push(`${file.name} failed to upload`);
    }
  }
  return { uploadedUrls, issues };
}

export default function AdminActivityOverrides() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const initialCenterId = typeof router.query.centerId === "string" ? router.query.centerId : "";
  const initialChildId = typeof router.query.childId === "string" ? router.query.childId : "";
  const [centerId, setCenterId] = useState(initialCenterId);
  const [childId, setChildId] = useState(initialChildId);
  const [activities, setActivities] = useState([]);
  const [createForm, setCreateForm] = useState(() => createEmptyForm("MEAL"));
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(() => createEmptyForm("OTHER"));
  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingActivityId, setSavingActivityId] = useState("");
  const [uploadingCreatePhotos, setUploadingCreatePhotos] = useState(false);
  const [uploadingEditPhotos, setUploadingEditPhotos] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterClassroomId, setFilterClassroomId] = useState("");
  const [filterChildId, setFilterChildId] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [detailChildId, setDetailChildId] = useState("");
  const createPhotoInputRef = useRef(null);
  const editPhotoInputRef = useRef(null);

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
      if (!centerId && Array.isArray(data) && data.length === 1) {
        setCenterId(data[0].id);
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadChildren(id) {
    if (!id) {
      setChildren([]);
      setClassrooms([]);
      setChildId("");
      setActivities([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [childrenData, classroomsData] = await Promise.all([
        apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`),
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(id)}`),
      ]);
      setChildren(Array.isArray(childrenData) ? childrenData : []);
      setClassrooms(Array.isArray(classroomsData) ? classroomsData : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities() {
    if (!centerId && !childId) {
      setActivities([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (childId) params.set("childId", childId);
      else if (centerId) params.set("centerId", centerId);
      const data = await apiJson(`/api/v1/activities?${params.toString()}`);
      setActivities(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSuccess("");
    loadChildren(centerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  useEffect(() => {
    setSuccess("");
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, centerId]);

  useEffect(() => {
    setCreateForm((current) => createEmptyForm(current.type || "MEAL"));
  }, [childId]);

  const childLabel = useMemo(() => {
    const child = children.find((entry) => entry.id === childId);
    return child ? fullChildName(child) : "";
  }, [children, childId]);

  const selectedCenterName = useMemo(() => {
    return centers.find((center) => center.id === centerId)?.name || "";
  }, [centers, centerId]);

  const classroomNameById = useMemo(() => {
    return new Map(
      classrooms
        .filter((classroom) => classroom?.id)
        .map((classroom) => [classroom.id, classroom.name || "Unnamed classroom"]),
    );
  }, [classrooms]);

  const classroomFilterOptions = useMemo(() => {
    const idsInScope = new Set(
      activities
        .map((activity) => activity?.child?.classRoomId)
        .filter(Boolean),
    );
    return classrooms
      .filter((classroom) => idsInScope.has(classroom.id))
      .slice()
      .sort((left, right) => (left.name || "").localeCompare(right.name || ""));
  }, [activities, classrooms]);

  const childFilterOptions = useMemo(() => {
    const childrenInScope = new Map();
    for (const activity of activities) {
      const child = activity?.child;
      if (!child?.id) continue;
      if (filterClassroomId && child.classRoomId !== filterClassroomId) continue;
      if (!childrenInScope.has(child.id)) {
        childrenInScope.set(child.id, child);
      }
    }
    return [...childrenInScope.values()].sort((left, right) =>
      fullChildName(left).localeCompare(fullChildName(right)),
    );
  }, [activities, filterClassroomId]);

  useEffect(() => {
    if (!childId) return;
    if (!children.some((child) => child.id === childId)) {
      setChildId("");
    }
  }, [children, childId]);

  useEffect(() => {
    if (!filterClassroomId) return;
    if (!classroomFilterOptions.some((classroom) => classroom.id === filterClassroomId)) {
      setFilterClassroomId("");
    }
  }, [classroomFilterOptions, filterClassroomId]);

  useEffect(() => {
    if (!filterChildId) return;
    if (!childFilterOptions.some((child) => child.id === filterChildId)) {
      setFilterChildId("");
    }
  }, [childFilterOptions, filterChildId]);

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filterType) list = list.filter((activity) => activity.type === filterType);
    if (filterClassroomId) {
      list = list.filter((activity) => activity?.child?.classRoomId === filterClassroomId);
    }
    if (filterChildId) {
      list = list.filter((activity) => activity?.child?.id === filterChildId);
    }
    if (filterFromDate) {
      const fromDate = new Date(`${filterFromDate}T00:00:00`);
      if (!Number.isNaN(fromDate.getTime())) {
        list = list.filter((activity) => new Date(activity.createdAt) >= fromDate);
      }
    }
    if (filterToDate) {
      const toDate = new Date(`${filterToDate}T23:59:59.999`);
      if (!Number.isNaN(toDate.getTime())) {
        list = list.filter((activity) => new Date(activity.createdAt) <= toDate);
      }
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((activity) => {
        const childName = fullChildName(activity?.child).toLowerCase();
        const classroomName = String(classroomNameById.get(activity?.child?.classRoomId) || "").toLowerCase();
        const recordedBy = String(activity?.recordedBy?.name || activity?.recordedBy?.email || "").toLowerCase();
        const summary = formatActivitySummary(activity).toLowerCase();
        return (
          String(activity?.notes || "").toLowerCase().includes(query) ||
          String(TYPE_META[activity?.type]?.label || activity?.type || "").toLowerCase().includes(query) ||
          childName.includes(query) ||
          classroomName.includes(query) ||
          recordedBy.includes(query) ||
          summary.includes(query)
        );
      });
    }
    return list;
  }, [
    activities,
    classroomNameById,
    filterChildId,
    filterClassroomId,
    filterFromDate,
    filterToDate,
    filterType,
    search,
  ]);

  const activityStats = useMemo(() => {
    const total = activities.length;
    const withPhotos = activities.filter((activity) => extractActivityMediaUrls(activity).length > 0).length;
    const assessments = activities.filter((activity) => hasAssessment(activity)).length;
    return { total, withPhotos, assessments };
  }, [activities]);

  const childSummaries = useMemo(() => {
    const map = new Map();
    for (const activity of filteredActivities) {
      const child = activity?.child;
      if (!child?.id) continue;
      if (!map.has(child.id)) {
        map.set(child.id, { child, counts: {}, total: 0, latestAt: activity.createdAt, activities: [] });
      }
      const entry = map.get(child.id);
      entry.counts[activity.type] = (entry.counts[activity.type] || 0) + 1;
      entry.total += 1;
      entry.activities.push(activity);
      if (new Date(activity.createdAt) > new Date(entry.latestAt)) {
        entry.latestAt = activity.createdAt;
      }
    }
    const list = [...map.values()];
    for (const entry of list) {
      entry.activities.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    }
    list.sort((left, right) => fullChildName(left.child).localeCompare(fullChildName(right.child)));
    return list;
  }, [filteredActivities]);

  const detailSummary = useMemo(
    () => childSummaries.find((summary) => summary.child.id === detailChildId) || null,
    [childSummaries, detailChildId],
  );

  useEffect(() => {
    if (!detailChildId) return;
    if (!childSummaries.some((summary) => summary.child.id === detailChildId)) {
      setDetailChildId("");
    }
  }, [childSummaries, detailChildId]);

  const dismissError = useCallback(() => setError(""), []);
  const dismissSuccess = useCallback(() => setSuccess(""), []);
  const clearListFilters = useCallback(() => {
    setFilterType("");
    setFilterClassroomId("");
    setFilterChildId("");
    setFilterFromDate("");
    setFilterToDate("");
    setSearch("");
  }, []);

  const hasActiveListFilters = Boolean(
    filterType ||
      filterClassroomId ||
      filterChildId ||
      filterFromDate ||
      filterToDate ||
      search.trim(),
  );

  function handleCenterChange(nextCenterId) {
    if (nextCenterId === centerId) return;
    setCenterId(nextCenterId);
    setChildId("");
    setActivities([]);
    clearListFilters();
    setError("");
    setSuccess("");
    cancelEditActivity();
  }

  function handleChildChange(nextChildId) {
    if (nextChildId === childId) return;
    setChildId(nextChildId);
    clearListFilters();
    setError("");
    setSuccess("");
    cancelEditActivity();
  }

  function setFormField(setter, key, value) {
    setter((current) => ({ ...current, [key]: value }));
  }

  function setNestedField(setter, field, value) {
    setter((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]: value,
      },
    }));
  }

  function toggleDomain(setter, domainKey, value) {
    setter((current) => {
      const nextScores = { ...asObject(current.domainScores) };
      if (nextScores[domainKey] === value) delete nextScores[domainKey];
      else nextScores[domainKey] = value;
      return { ...current, domainScores: nextScores };
    });
  }

  function clearDomains(setter) {
    setter((current) => ({ ...current, domainScores: {} }));
  }

  function removeMedia(setter, index) {
    setter((current) => ({
      ...current,
      mediaUrls: arr(current.mediaUrls).filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  async function handlePhotoUpload(list, mode) {
    const files = Array.from(list || []);
    if (!files.length) return;

    if (mode === "create") setUploadingCreatePhotos(true);
    else setUploadingEditPhotos(true);

    setError("");
    setSuccess("");

    try {
      const { uploadedUrls, issues } = await uploadFilesToUrls(files);
      if (uploadedUrls.length) {
        const setter = mode === "create" ? setCreateForm : setEditForm;
        setter((current) => ({
          ...current,
          mediaUrls: [...new Set([...(current.mediaUrls || []), ...uploadedUrls])],
        }));
      }
      if (issues.length) {
        setError(`Some photos were skipped: ${issues.slice(0, 2).join("; ")}`);
      }
    } finally {
      if (mode === "create" && createPhotoInputRef.current) createPhotoInputRef.current.value = "";
      if (mode === "edit" && editPhotoInputRef.current) editPhotoInputRef.current.value = "";
      if (mode === "create") setUploadingCreatePhotos(false);
      else setUploadingEditPhotos(false);
    }
  }

  async function createActivity(event) {
    event.preventDefault();
    setSuccess("");
    if (!childId) {
      setError("Select a child before creating a log.");
      return;
    }
    if (uploadingCreatePhotos) {
      setError("Wait for photos to finish uploading before saving.");
      return;
    }

    const validationMessage = getFormValidationMessage(createForm);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSavingCreate(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayloadFromForm(createForm);
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify({
          childId,
          type: payload.type,
          notes: payload.notes,
          details: payload.details,
          createdAt: payload.createdAt,
        }),
      });
      setCreateForm((current) => createEmptyForm(current.type || "MEAL"));
      setSuccess(`Activity "${TYPE_META[payload.type]?.label || payload.type}" created for ${childLabel || "child"}.`);
      await loadActivities();
    } catch (saveError) {
      setError(saveError.message || "Failed to create activity");
    } finally {
      setSavingCreate(false);
    }
  }

  function startEditActivity(activity) {
    setEditingId(activity?.id || "");
    setEditForm(buildFormFromActivity(activity));
    setError("");
    setSuccess("");
  }

  function cancelEditActivity() {
    setEditingId("");
    setEditForm(createEmptyForm("OTHER"));
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
  }

  async function saveActivity(activityId) {
    if (!activityId) return;
    setSuccess("");
    if (uploadingEditPhotos) {
      setError("Wait for photos to finish uploading before saving.");
      return;
    }

    const validationMessage = getFormValidationMessage(editForm);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSavingActivityId(activityId);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayloadFromForm(editForm);
      await apiJson(`/api/v1/activities/${encodeURIComponent(activityId)}`, {
        method: "PUT",
        body: JSON.stringify({
          type: payload.type,
          notes: payload.notes,
          details: payload.details,
          createdAt: payload.createdAt,
        }),
      });
      cancelEditActivity();
      setSuccess("Activity log updated.");
      await loadActivities();
    } catch (saveError) {
      setError(saveError.message || "Failed to update activity");
    } finally {
      setSavingActivityId("");
    }
  }

  async function deleteActivity(id) {
    if (!id) return;
    if (!confirm("Delete this activity log? This cannot be undone.")) return;

    setDeletingActivityId(id);
    setError("");
    setSuccess("");

    try {
      await apiJson(`/api/v1/activities/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (editingId === id) cancelEditActivity();
      setSuccess("Activity log deleted.");
      await loadActivities();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete activity");
    } finally {
      setDeletingActivityId("");
    }
  }

  return (
    <AdminLayout title="Log Activity">
      <Panel style={heroPanelStyle}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={heroTopRowStyle}>
            <div style={heroIdentityStyle}>
              <div style={heroIconStyle}>AL</div>
              <div>
                <div style={heroEyebrowStyle}>Admin Activity Log</div>
                <h2 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: "var(--admin-text)" }}>
                  {childLabel || selectedCenterName || "Center activity control"}
                </h2>
                <p style={{ margin: "10px 0 0", maxWidth: 700, fontSize: 13, lineHeight: 1.65, color: "var(--admin-text-muted)" }}>
                  Review logs, correct timestamps, and create admin entries using the same structured logging flow as teachers.
                </p>
              </div>
            </div>
            <div style={simpleHeaderMetaStyle}>
              <HeroPill tone="indigo">{selectedCenterName || "Select a center"}</HeroPill>
              <HeroPill tone={childLabel ? "emerald" : "slate"}>{childLabel || "Center-wide review"}</HeroPill>
            </div>
          </div>
          <div style={heroMetricsGridStyle}>
            <div style={heroMetricCardStyle}>
              <div style={heroMetricLabelStyle}>Logs in view</div>
              <div style={heroMetricValueStyle}>{activityStats.total}</div>
              <div style={heroMetricHintStyle}>Current scope</div>
            </div>
            <div style={heroMetricCardStyle}>
              <div style={heroMetricLabelStyle}>With Photos</div>
              <div style={heroMetricValueStyle}>{activityStats.withPhotos}</div>
              <div style={heroMetricHintStyle}>Media attached</div>
            </div>
            <div style={heroMetricCardStyle}>
              <div style={heroMetricLabelStyle}>Assessments</div>
              <div style={heroMetricValueStyle}>{activityStats.assessments}</div>
              <div style={heroMetricHintStyle}>Grade or domain scoring</div>
            </div>
          </div>
        </div>
      </Panel>

      {error ? <AlertBanner kind="error" message={error} onDismiss={dismissError} /> : null}
      {success ? <AlertBanner kind="success" message={success} onDismiss={dismissSuccess} /> : null}

      <Panel>
        <div style={scopeLayoutStyle}>
          <div style={{ minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Scope</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: "var(--admin-text-muted)" }}>
                Choose a center and optionally narrow the page to one child before creating a log.
              </div>
            </div>
            <div style={{ ...responsiveTwoColStyle, marginTop: 14 }}>
              <Field label="Center" style={{ minWidth: 0 }}>
                <select value={centerId} onChange={(event) => handleCenterChange(event.target.value)} style={inputStyle}>
                  <option value="">Select a center...</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Child" style={{ minWidth: 0 }}>
                <select
                  value={childId}
                  onChange={(event) => handleChildChange(event.target.value)}
                  style={{ ...inputStyle, opacity: centerId ? 1 : 0.55 }}
                  disabled={!centerId}
                >
                  <option value="">{centerId ? "All children in this center" : "Select a center first"}</option>
                  {children
                    .slice()
                    .sort((left, right) => fullChildName(left).localeCompare(fullChildName(right)))
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        {fullChildName(child)}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </div>
          <div style={scopeSummaryCardStyle}>
            <div style={scopeSummaryLabelStyle}>Current view</div>
            <div style={scopeSummaryTitleStyle}>
              {childLabel || selectedCenterName || "Center activity control"}
            </div>
            <div style={scopeNoteStyle}>
              {childLabel
                ? `New entries will attach to ${childLabel}.`
                : selectedCenterName
                  ? "The list shows every child log in this center. Select a child to create a new entry."
                  : "Pick a center first so logs and children stay aligned."}
            </div>
            <div style={{ ...simpleHeaderMetaStyle, marginTop: 12 }}>
              <HeroPill tone="sky">{activityStats.total} logs</HeroPill>
              <HeroPill tone="emerald">{activityStats.withPhotos} with photos</HeroPill>
              <HeroPill tone="slate">{childLabel ? "Entry enabled" : "Review mode"}</HeroPill>
            </div>
          </div>
        </div>
      </Panel>

      {childId ? (
        <Panel style={{ marginTop: 16 }}>
          <ActivityComposer
            title="New Activity Log"
            description="This form matches the teacher flow, with admin control over the full entry date and time."
            childLabel={childLabel}
            form={createForm}
            onTypeChange={(nextType) => setCreateForm((current) => applyTypeChange(current, nextType))}
            onFormFieldChange={(key, value) => setFormField(setCreateForm, key, value)}
            onNestedFieldChange={(field, value) => setNestedField(setCreateForm, field, value)}
            onDomainToggle={(domainKey, value) => toggleDomain(setCreateForm, domainKey, value)}
            onClearDomains={() => clearDomains(setCreateForm)}
            onUploadPhotos={(files) => handlePhotoUpload(files, "create")}
            onRemoveMedia={(index) => removeMedia(setCreateForm, index)}
            photoInputRef={createPhotoInputRef}
            uploadingPhotos={uploadingCreatePhotos}
            busy={savingCreate}
            onSubmit={createActivity}
            submitLabel="Create Log"
          />
        </Panel>
      ) : null}

      <Panel style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Activity Logs</span>
            {activities.length ? (
              <span style={countChipStyle}>
                {filteredActivities.length}
                {filteredActivities.length !== activities.length ? ` / ${activities.length}` : ""}
              </span>
            ) : null}
            {filterType ? <HeroPill tone="sky">{TYPE_META[filterType]?.label || filterType}</HeroPill> : null}
            {filterClassroomId ? (
              <HeroPill tone="indigo">{classroomNameById.get(filterClassroomId) || "Classroom"}</HeroPill>
            ) : null}
            {filterChildId ? (
              <HeroPill tone="emerald">
                {fullChildName(childFilterOptions.find((child) => child.id === filterChildId)) || "Child"}
              </HeroPill>
            ) : null}
            {filterFromDate || filterToDate ? (
              <HeroPill tone="rose">
                {filterFromDate || "Start"} to {filterToDate || "Now"}
              </HeroPill>
            ) : null}
          </div>
          {centerId ? (
            <div style={toolbarCardStyle}>
              <Field label="Log Type" style={toolbarFieldStyle}>
                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  style={toolbarInputStyle}
                >
                  <option value="">All types</option>
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_META[type]?.label || type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Filter Classroom" style={toolbarFieldStyle}>
                <select
                  value={filterClassroomId}
                  onChange={(event) => setFilterClassroomId(event.target.value)}
                  style={toolbarInputStyle}
                >
                  <option value="">All classrooms</option>
                  {classroomFilterOptions.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Filter Child" style={toolbarFieldStyle}>
                <select
                  value={filterChildId}
                  onChange={(event) => setFilterChildId(event.target.value)}
                  style={toolbarInputStyle}
                >
                  <option value="">All children</option>
                  {childFilterOptions.map((child) => (
                    <option key={child.id} value={child.id}>
                      {fullChildName(child)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From Date" style={toolbarDateFieldStyle}>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(event) => setFilterFromDate(event.target.value)}
                  style={toolbarInputStyle}
                />
              </Field>
              <Field label="To Date" style={toolbarDateFieldStyle}>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(event) => setFilterToDate(event.target.value)}
                  style={toolbarInputStyle}
                />
              </Field>
              <Field label="Search Logs" style={toolbarSearchFieldStyle}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notes, child, teacher, classroom, or summary"
                  style={toolbarInputStyle}
                />
              </Field>
              {hasActiveListFilters ? (
                <button type="button" onClick={clearListFilters} style={smallActionButton}>
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : !centerId ? (
          <EmptyState
            title="No center selected"
            description="Select a center above to review and manage activity logs."
          />
        ) : childSummaries.length === 0 && activities.length === 0 ? (
          <EmptyState
            title="No activity logs yet"
            description={`No logs found for ${childLabel || "this center"}. Use the composer above to create one once a child is selected.`}
          />
        ) : childSummaries.length === 0 ? (
          <EmptyState
            title="No matching logs"
            description="Adjust the filter or search text to find the logs you need."
          />
        ) : (
          <div style={tableShellStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Child</th>
                  <th style={thStyle}>Activity</th>
                  <th style={{ ...thStyle, width: 150 }}>Last Logged</th>
                </tr>
              </thead>
              <tbody>
                {childSummaries.map((summary) => {
                  const { child, counts, total, latestAt } = summary;
                  return (
                    <tr key={child.id} style={rowStyle}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => setDetailChildId(child.id)}
                          style={childNameButtonStyle}
                        >
                          <span style={childAvatarStyle}>{childInitials(fullChildName(child))}</span>
                          <span>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-brand, #2563eb)" }}>
                              {fullChildName(child) || "Unnamed child"}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-text-muted)" }}>
                              {classroomNameById.get(child.classRoomId) || "No classroom"}
                            </div>
                          </span>
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {TYPES.map((type) => {
                            const meta = TYPE_META[type];
                            const count = counts[type] || 0;
                            return (
                              <span
                                key={type}
                                title={`${meta.label}: ${count}`}
                                style={{
                                  ...typeIconBadgeStyle,
                                  background: count ? meta.tint : "var(--admin-bg-secondary, #f1f5f9)",
                                  color: count ? meta.color : "var(--admin-text-muted)",
                                  opacity: count ? 1 : 0.45,
                                }}
                              >
                                <span aria-hidden="true">{meta.icon}</span>
                                <span style={typeIconCountStyle}>{count}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>
                          {relativeTime(latestAt)}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                          {total} log{total === 1 ? "" : "s"} recorded
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {detailSummary ? (
        <div style={drawerBackdropStyle} onClick={() => setDetailChildId("")}>
          <div style={drawerPanelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={childAvatarStyle}>{childInitials(fullChildName(detailSummary.child))}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--admin-text)" }}>
                    {fullChildName(detailSummary.child) || "Unnamed child"}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-text-muted)" }}>
                    {classroomNameById.get(detailSummary.child.classRoomId) || "No classroom"} &middot;{" "}
                    {detailSummary.total} log{detailSummary.total === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailChildId("")}
                style={drawerCloseButtonStyle}
                aria-label="Close child activity details"
              >
                ✕
              </button>
            </div>

            <div style={drawerTypeSummaryStyle}>
              {TYPES.filter((type) => detailSummary.counts[type]).map((type) => {
                const meta = TYPE_META[type];
                return (
                  <span key={type} style={{ ...typeIconBadgeStyle, background: meta.tint, color: meta.color }}>
                    <span aria-hidden="true">{meta.icon}</span> {meta.label} &middot; {detailSummary.counts[type]}
                  </span>
                );
              })}
            </div>

            <div style={drawerBodyStyle}>
              {groupActivitiesByDay(detailSummary.activities).map((group) => (
                <div key={group.key} style={{ marginBottom: 18 }}>
                  <div style={drawerDayHeaderStyle}>{group.label}</div>
                  {group.items.map((activity) => {
                    const meta = TYPE_META[activity.type] || TYPE_META.OTHER;
                    const isEditing = editingId === activity.id;
                    const isDeleting = deletingActivityId === activity.id;
                    const metaPills = buildActivityMetaPills(activity);
                    return (
                      <div key={activity.id} style={drawerEntryCardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...typeIconBadgeStyle, background: meta.tint, color: meta.color }}>
                              <span aria-hidden="true">{meta.icon}</span>
                            </span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                                {meta.label}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                                {formatDateTime(activity.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => startEditActivity(activity)}
                              style={smallActionButton}
                              disabled={isDeleting}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteActivity(activity.id)}
                              style={deleteIconButton}
                              disabled={isDeleting}
                              title="Delete activity log"
                            >
                              {isDeleting ? "..." : "Delete"}
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--admin-text)" }}>
                          {activity.notes || formatActivitySummary(activity) || "No additional notes"}
                        </div>
                        {activity.notes ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                            {formatActivitySummary(activity)}
                          </div>
                        ) : null}
                        {metaPills.length ? (
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {metaPills.map((pill, index) => (
                              <span key={index} style={metaPillStyle}>
                                {pill.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {isEditing ? (
                          <div style={{ marginTop: 12 }}>
                            <ActivityComposer
                              title="Edit Activity Log"
                              description="Update the structured details, photos, and admin-controlled timestamp for this log."
                              childLabel={fullChildName(activity.child)}
                              form={editForm}
                              onTypeChange={(nextType) => setEditForm((current) => applyTypeChange(current, nextType))}
                              onFormFieldChange={(key, value) => setFormField(setEditForm, key, value)}
                              onNestedFieldChange={(field, value) => setNestedField(setEditForm, field, value)}
                              onDomainToggle={(domainKey, value) => toggleDomain(setEditForm, domainKey, value)}
                              onClearDomains={() => clearDomains(setEditForm)}
                              onUploadPhotos={(files) => handlePhotoUpload(files, "edit")}
                              onRemoveMedia={(index) => removeMedia(setEditForm, index)}
                              photoInputRef={editPhotoInputRef}
                              uploadingPhotos={uploadingEditPhotos}
                              busy={savingActivityId === activity.id}
                              onSubmit={(event) => {
                                event.preventDefault();
                                saveActivity(activity.id);
                              }}
                              onCancel={cancelEditActivity}
                              submitLabel="Save Changes"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

function ActivityComposer({
  title,
  description,
  childLabel,
  form,
  onTypeChange,
  onFormFieldChange,
  onNestedFieldChange,
  onDomainToggle,
  onClearDomains,
  onUploadPhotos,
  onRemoveMedia,
  photoInputRef,
  uploadingPhotos,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  const selectedMealOptions = useMemo(() => {
    if (form.type === "SNACK") {
      return MEAL_OCCASIONS.filter((option) => option.value.includes("SNACK"));
    }
    return MEAL_OCCASIONS;
  }, [form.type]);
  const helperText = useMemo(() => composerHelperText(form.type), [form.type]);
  const descriptionPlaceholder = useMemo(() => composerDescriptionPlaceholder(form.type), [form.type]);
  const domainScores = useMemo(() => asObject(form.domainScores), [form.domainScores]);
  const domainScoreCount = useMemo(
    () => Object.values(domainScores).filter((value) => Number(value) > 0).length,
    [domainScores],
  );
  const overallAssessment = useMemo(() => getAssessmentOverall(domainScores), [domainScores]);
  const hasAssessmentValue = domainScoreCount > 0;
  const validationMessage = useMemo(() => getFormValidationMessage(form), [form]);
  const interactionDisabled = busy || uploadingPhotos;
  const [assessmentOpen, setAssessmentOpen] = useState(hasAssessmentValue);

  useEffect(() => {
    if (hasAssessmentValue) setAssessmentOpen(true);
  }, [hasAssessmentValue]);

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>{title}</div>
          {description ? (
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>{description}</div>
          ) : null}
        </div>
        {childLabel ? <Chip>{childLabel}</Chip> : null}
      </div>

      {uploadingPhotos ? (
        <div role="status" style={formNoticeStyle}>
          Photos are still uploading. Save will unlock when the upload finishes.
        </div>
      ) : null}
      {validationMessage ? (
        <div role="alert" style={formErrorStyle}>
          {validationMessage}
        </div>
      ) : null}

      <div style={composerGridStyle}>
        <div style={{ ...sectionCardStyle, gridColumn: "1 / -1" }}>
          <SectionHeading
            title="1. Admin Timestamp"
            description="Set the date and time for this entry."
          />
          <div style={{ ...responsiveTwoColStyle, alignItems: "start" }}>
            <Field label="Date & Time" style={{ minWidth: 0 }}>
              <input
                type="datetime-local"
                value={form.createdAt}
                onChange={(event) => onFormFieldChange("createdAt", event.target.value)}
                style={inputStyle}
                disabled={interactionDisabled}
              />
            </Field>
            <div style={sectionHintStyle}>
              This timestamp is editable for new logs and inline edits. Structured log types below reuse this time unless a nap range is entered.
            </div>
          </div>
        </div>

        <div style={{ ...sectionCardStyle, gridColumn: "1 / -1" }}>
          <SectionHeading
            title="2. Log details"
            description="Choose an activity type and add a short note if needed."
          />
          <div style={detailSplitLayoutStyle}>
            <div style={subSectionCardStyle}>
              <Field label="Type" style={{ minWidth: 0 }}>
                <select
                  value={form.type}
                  onChange={(event) => onTypeChange(event.target.value)}
                  style={inputStyle}
                  disabled={interactionDisabled}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_META[type]?.label || type}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {QUICK_TYPE_OPTIONS.map((type) => {
                  const active = form.type === type;
                  const meta = TYPE_META[type] || TYPE_META.OTHER;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onTypeChange(type)}
                      style={{
                        ...typeChipButtonStyle,
                        background: active ? meta.tint : "var(--admin-bg)",
                        borderColor: active ? meta.color : "var(--admin-border)",
                        color: active ? meta.color : "var(--admin-text-muted)",
                        boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.45)" : "none",
                      }}
                      disabled={interactionDisabled}
                    >
                      {TYPE_META[type]?.label || type}
                    </button>
                  );
                })}
              </div>
              <div style={inlineNoteStyle}>
                Use <strong>Grade</strong> for a 0-10 score entry.
              </div>
            </div>

            <div style={subSectionCardStyle}>
              <div style={subSectionEyebrowStyle}>Activity requirements</div>
              <div style={{ ...responsiveTwoColStyle, marginTop: 10 }}>
                {form.type === "NAP" ? (
                  <>
                    <Field label="Start time" style={{ minWidth: 0 }}>
                      <input
                        type="time"
                        value={form.fields.napStartTime}
                        onChange={(event) => onNestedFieldChange("napStartTime", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      />
                    </Field>
                    <Field label="End time" style={{ minWidth: 0 }}>
                      <input
                        type="time"
                        value={form.fields.napEndTime}
                        onChange={(event) => onNestedFieldChange("napEndTime", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      />
                    </Field>
                  </>
                ) : null}

                {supportsDirectGrade(form.type) ? (
                  <Field label="Grade" style={{ minWidth: 0 }}>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="1"
                      value={form.dailyGrade}
                      onChange={(event) => onFormFieldChange("dailyGrade", event.target.value)}
                      style={inputStyle}
                      disabled={interactionDisabled}
                      placeholder="0-10"
                    />
                  </Field>
                ) : null}

                {["MEAL", "SNACK"].includes(form.type) ? (
                  <>
                    <Field label="Meal type" style={{ minWidth: 0 }}>
                      <select
                        value={form.fields.mealType}
                        onChange={(event) => onNestedFieldChange("mealType", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      >
                        {selectedMealOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantity" style={{ minWidth: 0 }}>
                      <select
                        value={form.fields.quantity}
                        onChange={(event) => onNestedFieldChange("quantity", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      >
                        {PORTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}

                {form.type === "BOTTLE" ? (
                  <Field label="Quantity" style={{ minWidth: 0 }}>
                    <select
                      value={form.fields.bottleQuantity}
                      onChange={(event) => onNestedFieldChange("bottleQuantity", event.target.value)}
                      style={inputStyle}
                      disabled={interactionDisabled}
                    >
                      {BOTTLE_PORTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                {form.type === "DIAPER_CHANGE" ? (
                  <Field label="Diaper type" style={{ minWidth: 0 }}>
                    <select
                      value={form.fields.diaperType}
                      onChange={(event) => onNestedFieldChange("diaperType", event.target.value)}
                      style={inputStyle}
                      disabled={interactionDisabled}
                    >
                      {DIAPER_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                {supportsToiletingDetails(form.type) ? (
                  <Field label="Type" style={{ minWidth: 0 }}>
                    <select
                      value={form.fields.toiletingType}
                      onChange={(event) => onNestedFieldChange("toiletingType", event.target.value)}
                      style={inputStyle}
                      disabled={interactionDisabled}
                    >
                      {TOILETING_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                {supportsBehaviorDetails(form.type) ? (
                  <>
                    <Field label="Behavior type" style={{ minWidth: 0 }}>
                      <select
                        value={form.fields.behaviorType}
                        onChange={(event) => onNestedFieldChange("behaviorType", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      >
                        {BEHAVIOR_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Behavior level" style={{ minWidth: 0 }}>
                      <select
                        value={form.fields.behaviorLevel}
                        onChange={(event) => onNestedFieldChange("behaviorLevel", event.target.value)}
                        style={inputStyle}
                        disabled={interactionDisabled}
                      >
                        {BEHAVIOR_LEVEL_OPTIONS.map((level) => (
                          <option key={level} value={level}>
                            Level {level}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}
              </div>
              {!["NAP", "MEAL", "SNACK", "BOTTLE", "DIAPER_CHANGE", "BEHAVIOR", "INCIDENT", "TOILETING"].includes(form.type) ? (
                <div style={inlineHelperStyle}>
                  This activity type only needs the timestamp and description unless you want to attach assessment, photos, or custom JSON.
                </div>
              ) : null}
              <div style={inlineHelperStyle}>{helperText}</div>
            </div>
          </div>
          <Field label="Description" style={{ gridColumn: "1 / -1" }}>
            <textarea
              value={form.notes}
              onChange={(event) => onFormFieldChange("notes", event.target.value)}
              style={textareaStyle}
              disabled={interactionDisabled}
              placeholder={descriptionPlaceholder}
            />
          </Field>
        </div>

        <div style={{ ...sectionCardStyle, gridColumn: "1 / -1" }}>
          <button
            type="button"
            onClick={() => setAssessmentOpen((current) => !current)}
            style={assessmentToggleButtonStyle}
            disabled={interactionDisabled}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--admin-text)" }}>
                Step 3 - Developmental Assessment (optional)
              </div>
              <div style={sectionSummaryStyle}>
                {domainScoreCount > 0
                  ? `${domainScoreCount} domain(s) rated`
                  : "Rate child across developmental domains"}
              </div>
            </div>
            <span style={assessmentToggleTextStyle}>{assessmentOpen ? "Collapse" : "Expand"}</span>
          </button>

          {assessmentOpen ? (
            <div style={assessmentPanelBodyStyle}>
              <div style={domainGridStyle}>
                {ASSESSMENT_DOMAINS.map((domain) => {
                  const current = Number(domainScores[domain.key] || 0);
                  return (
                    <div key={domain.key} style={domainCardStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            ...domainBadgeStyle,
                            background: domain.tint,
                            color: domain.color,
                            borderColor: domain.borderColor,
                          }}
                        >
                          {domain.badge}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{domain.label}</div>
                          <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.45, color: "var(--admin-text-muted)" }}>
                            {domain.description}
                          </div>
                        </div>
                      </div>
                      <div style={rubricButtonRowStyle}>
                        {RUBRIC_LEVELS.map((level) => {
                          const active = current === level.value;
                          return (
                            <button
                              key={level.value}
                              type="button"
                              onClick={() => onDomainToggle(domain.key, level.value)}
                              style={{
                                ...rubricButtonStyle,
                                background: active ? level.background : "var(--admin-bg)",
                                borderColor: active ? level.borderColor : "var(--admin-border)",
                                color: active ? level.color : "var(--admin-text-muted)",
                              }}
                              disabled={interactionDisabled}
                            >
                              {level.value} {level.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {overallAssessment ? (
                <div style={assessmentSummaryCardStyle}>
                  <div style={{ fontSize: 12, color: "#0f3b66" }}>
                    <strong>Overall:</strong> {overallAssessment.label}
                    <span style={{ marginLeft: 8, color: "#2563eb" }}>
                      ({overallAssessment.count}/{ASSESSMENT_DOMAINS.length} domains)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClearDomains}
                    style={clearDomainsButtonStyle}
                    disabled={interactionDisabled}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ ...sectionCardStyle, gridColumn: "1 / -1" }}>
          <SectionHeading
            title="4. Photos"
            description="Upload optional activity photos. Files are uploaded immediately and can be removed before saving."
          />
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              ref={photoInputRef}
              type="file"
              aria-label="Activity photos"
              accept="image/*"
              multiple
              className="hidden"
              disabled={interactionDisabled}
              onChange={(event) => onUploadPhotos(event.target.files)}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={secondaryButton}
              disabled={interactionDisabled}
            >
              {uploadingPhotos ? "Uploading..." : "Add Photos"}
            </button>
          </div>
          {arr(form.mediaUrls).length ? (
            <div style={mediaGridStyle}>
              {arr(form.mediaUrls).map((url, index) => (
                <div key={`${url}-${index}`} style={mediaCardStyle}>
                  <img src={url} alt={`Activity media ${index + 1}`} style={mediaImageStyle} />
                  <button
                    type="button"
                    onClick={() => onRemoveMedia(index)}
                    style={mediaRemoveButtonStyle}
                    disabled={interactionDisabled}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-text-muted)" }}>
              No photos attached.
            </div>
          )}
        </div>

        <div style={{ ...sectionCardStyle, gridColumn: "1 / -1" }}>
          <SectionHeading
            title="5. Advanced Details"
            description="Only use extra JSON when you need to preserve custom detail beyond the structured fields above."
          />
          <Field label="Extra Details JSON" style={{ gridColumn: "1 / -1" }}>
            <textarea
              value={form.extraDetailsText}
              onChange={(event) => onFormFieldChange("extraDetailsText", event.target.value)}
              style={textareaStyle}
              disabled={interactionDisabled}
              placeholder='{"customField":"value"}'
            />
          </Field>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryButton} disabled={interactionDisabled}>
            Cancel
          </button>
        ) : null}
        <button type="submit" style={primaryButton} disabled={interactionDisabled || !!validationMessage}>
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Panel({ children, style }) {
  return (
    <div
      style={{
        background: "var(--admin-bg)",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label style={{ display: "block", ...style }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--admin-text-muted)", marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function AlertBanner({ message, kind, onDismiss }) {
  const success = kind === "success";
  const background = success ? "var(--admin-success-bg)" : "var(--admin-error-bg)";
  const color = success ? "var(--admin-success-text)" : "var(--admin-error-text)";
  const border = success ? "var(--admin-success-border)" : "var(--admin-error-border)";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        marginBottom: 14,
        background,
        color,
        border: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color,
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            opacity: 0.6,
          }}
        >
          x
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--admin-text-muted)" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  );
}

function Chip({ children }) {
  return <span style={chipStyle}>{children}</span>;
}

function HeroPill({ children, tone = "slate" }) {
  const toneStyle = pillToneStyles[tone] || pillToneStyles.slate;
  return <span style={{ ...heroPillStyle, ...toneStyle }}>{children}</span>;
}

function SectionHeading({ title, description }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--admin-text)" }}>{title}</div>
      {description ? (
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: "var(--admin-text-muted)" }}>
          {description}
        </div>
      ) : null}
    </div>
  );
}

const heroPanelStyle = {
  marginBottom: 16,
  padding: 22,
  background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 58%, #f8fafc 100%)",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
};

const heroEyebrowStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--admin-text-muted)",
};

const heroIdentityStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};

const heroIconStyle = {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white",
  fontSize: 13,
  fontWeight: 800,
  boxShadow: "0 12px 22px rgba(37, 99, 235, 0.18)",
  flexShrink: 0,
};

const simpleHeaderMetaStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const heroTopRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const heroMetricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const heroMetricCardStyle = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.88)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
};

const heroMetricLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--admin-text-muted)",
};

const heroMetricValueStyle = {
  marginTop: 8,
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 800,
  color: "var(--admin-text)",
};

const heroMetricHintStyle = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--admin-text-muted)",
};

const heroPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid transparent",
};

const pillToneStyles = {
  slate: { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" },
  indigo: { background: "#dbeafe", color: "#1d4ed8", borderColor: "#bfdbfe" },
  sky: { background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" },
  emerald: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" },
  amber: { background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" },
  rose: { background: "#ffe4e6", color: "#be123c", borderColor: "#fecdd3" },
};

const responsiveTwoColStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const scopeLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  alignItems: "stretch",
};

const scopeSummaryCardStyle = {
  padding: 16,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "linear-gradient(180deg, #fcfdff 0%, var(--admin-bg) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
};

const scopeSummaryLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--admin-text-muted)",
};

const scopeSummaryTitleStyle = {
  marginTop: 6,
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 800,
  color: "var(--admin-text)",
};

const scopeNoteStyle = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.6,
  color: "var(--admin-text-muted)",
};

const composerGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const toolbarCardStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "flex-end",
  padding: 8,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
};

const toolbarFieldStyle = {
  minWidth: 160,
  flex: "0 1 180px",
};

const toolbarDateFieldStyle = {
  minWidth: 140,
  flex: "0 1 150px",
};

const toolbarSearchFieldStyle = {
  minWidth: 240,
  flex: "1 1 280px",
};

const toolbarInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxSizing: "border-box",
  fontSize: 13,
};

const domainGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxSizing: "border-box",
  fontSize: 14,
  background: "#f9fafb",
  color: "var(--admin-text)",
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 88,
  resize: "vertical",
};

const sectionCardStyle = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.03)",
};

const detailSplitLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  alignItems: "start",
};

const subSectionCardStyle = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
};

const typeChipButtonStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  transition: "all 0.15s ease",
};

const sectionHintStyle = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 12,
  lineHeight: 1.6,
  color: "var(--admin-text-muted)",
};

const formNoticeStyle = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  fontSize: 12,
  lineHeight: 1.6,
  color: "#1d4ed8",
};

const formErrorStyle = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  fontSize: 12,
  lineHeight: 1.6,
  color: "#b91c1c",
};

const domainCardStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

const domainBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 38,
  height: 38,
  padding: "0 8px",
  borderRadius: 10,
  border: "1px solid transparent",
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: "0.04em",
};

const rubricButtonRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
};

const rubricButtonStyle = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  textAlign: "center",
};

const inlineNoteStyle = {
  marginTop: 10,
  fontSize: 12,
  lineHeight: 1.6,
  color: "var(--admin-text-muted)",
};

const inlineHelperStyle = {
  marginTop: 12,
  fontSize: 12,
  lineHeight: 1.6,
  color: "var(--admin-text-muted)",
};

const subSectionEyebrowStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--admin-text-muted)",
};

const assessmentToggleButtonStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 0,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const sectionSummaryStyle = {
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--admin-text-muted)",
};

const assessmentToggleTextStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
};

const assessmentPanelBodyStyle = {
  display: "grid",
  gap: 12,
  marginTop: 12,
};

const assessmentQuickGradeCardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "end",
  padding: 14,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "linear-gradient(180deg, #f8fbff 0%, #fdfefe 100%)",
};

const assessmentQuickGradeTextStyle = {
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.6,
  color: "var(--admin-text-muted)",
};

const assessmentSummaryCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #dbeafe",
  background: "#f8fbff",
};

const clearDomainsButtonStyle = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const chipStyle = {
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "var(--admin-text-muted)",
};

const countChipStyle = {
  fontSize: 11,
  fontWeight: 700,
  background: "#f3f4f6",
  color: "var(--admin-text-muted)",
  padding: "2px 8px",
  borderRadius: 999,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableShellStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
  background: "var(--admin-bg)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.03)",
};

const thStyle = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  padding: "10px 14px",
  borderBottom: "2px solid var(--admin-border)",
};

const tdStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--admin-border-light, var(--admin-border))",
  verticalAlign: "top",
};

const rowStyle = {
  transition: "background 0.15s",
  background: "var(--admin-bg)",
};

const primaryButton = {
  padding: "9px 18px",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 18px rgba(37, 99, 235, 0.16)",
};

const secondaryButton = {
  padding: "9px 14px",
  background: "#fcfdff",
  color: "var(--admin-text)",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
};

const smallActionButton = {
  ...secondaryButton,
  padding: "6px 10px",
  fontSize: 12,
};

const deleteIconButton = {
  ...smallActionButton,
  color: "#b91c1c",
  borderColor: "#fecaca",
  background: "#fff1f2",
};

const mediaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const mediaCardStyle = {
  overflow: "hidden",
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
};

const mediaImageStyle = {
  display: "block",
  width: "100%",
  height: 110,
  objectFit: "cover",
  background: "var(--admin-bg-secondary)",
};

const mediaRemoveButtonStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "none",
  borderTop: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const childAvatarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white",
  fontSize: 12,
  fontWeight: 800,
  flexShrink: 0,
};

const childNameButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

const typeIconBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const typeIconCountStyle = {
  fontSize: 11,
  fontWeight: 800,
};

const metaPillStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 999,
  background: "var(--admin-bg-secondary, #f1f5f9)",
  color: "var(--admin-text-muted)",
};

const drawerBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 1000,
};

const drawerPanelStyle = {
  width: "min(480px, 100%)",
  height: "100%",
  background: "var(--admin-bg)",
  boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const drawerHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "18px 20px",
  borderBottom: "1px solid var(--admin-border)",
};

const drawerCloseButtonStyle = {
  border: "1px solid #e5e7eb",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  borderRadius: 10,
  width: 32,
  height: 32,
  cursor: "pointer",
  fontSize: 14,
  flexShrink: 0,
};

const drawerTypeSummaryStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  padding: "14px 20px",
  borderBottom: "1px solid var(--admin-border)",
};

const drawerBodyStyle = {
  padding: "16px 20px",
  overflowY: "auto",
  flex: 1,
};

const drawerDayHeaderStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 8,
};

const drawerEntryCardStyle = {
  border: "1px solid var(--admin-border)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
  background: "var(--admin-bg-secondary, #f8fafc)",
};
