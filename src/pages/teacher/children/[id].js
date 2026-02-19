
import TeacherLayout from "@/components/teacher/TeacherLayout";
import CatchupPlansPanel from "@/components/reports/CatchupPlansPanel";
import MilestoneCalendarPanel from "@/components/reports/MilestoneCalendarPanel";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PROGRESS_STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "PASSED", "FAILED"];
const ACTIVITY_TYPES = ["DIAPER_CHANGE", "NAP", "BOTTLE", "MEAL", "SNACK", "ACTIVITY", "TASK_CHECKLIST", "BEHAVIOR", "OTHER"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const AGE_GROUPS = [
  { key: "0-1", label: "0-1 year", min: 0, max: 11, tags: ["0-1", "infant"] },
  { key: "2", label: "2 years", min: 12, max: 23, tags: ["2"] },
  { key: "3", label: "3 years", min: 24, max: 35, tags: ["3"] },
  { key: "4-5", label: "4-5 years", min: 36, max: 59, tags: ["4-5", "4", "5"] },
  { key: "6-7", label: "6-7 years", min: 60, max: 83, tags: ["6-7", "6", "7"] },
  { key: "8-12", label: "8-12 years", min: 84, max: 143, tags: ["8-12", "8", "9", "10", "11", "12"] },
];

function arr(v) {
  return Array.isArray(v) ? v : [];
}
function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function extractActivityMediaUrls(activity) {
  const details = asObject(activity?.details);
  const raw = [...arr(details.media), ...arr(details.photos)];
  const urls = raw
    .map((m) => {
      if (typeof m === "string") return m.trim();
      if (m && typeof m === "object" && typeof m.url === "string") return m.url.trim();
      return "";
    })
    .filter(Boolean);
  return [...new Set(urls)];
}
const DOMAIN_LABELS = {
  cognitive: "Cognitive", social: "Social", physical: "Physical",
  language: "Language", creative: "Creative",
};
const LEVEL_NAMES = { 1: "Emerging", 2: "Developing", 3: "Proficient", 4: "Advanced" };
const LEVEL_BADGE = {
  1: "bg-amber-100 text-amber-800", 2: "bg-sky-100 text-sky-800",
  3: "bg-emerald-100 text-emerald-800", 4: "bg-violet-100 text-violet-800",
};

function extractDailyGrade(activity) {
  const details = asObject(activity?.details);
  if (details.kind !== "DAILY_GRADE") return "";
  const grade = Number(details.grade);
  return Number.isFinite(grade) ? String(grade) : "";
}
function extractDomains(activity) {
  const details = asObject(activity?.details);
  return details.kind === "DAILY_GRADE" && details.domains ? details.domains : null;
}
function fullName(child) {
  return `${child?.firstName || ""}${child?.lastName ? ` ${child.lastName}` : ""}`.trim();
}
function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}
function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}
function ageInMonths(v) {
  if (!v) return null;
  const dob = new Date(v);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months;
}
function ageGroupKeyFromBirthDate(v) {
  const months = ageInMonths(v);
  if (months === null) return "";
  return AGE_GROUPS.find((g) => months >= g.min && months <= g.max)?.key || "";
}
function mapAgeRangeToGroup(v) {
  const text = String(v || "").trim().toLowerCase();
  if (!text) return "";
  const exact = AGE_GROUPS.find((g) => g.tags.includes(text));
  if (exact) return exact.key;
  return AGE_GROUPS.find((g) => g.tags.some((tag) => text.includes(tag)))?.key || "";
}
function planEndDate(plan) {
  const start = plan?.periodStart ? new Date(plan.periodStart) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  if (plan.period === "DAY") end.setDate(end.getDate() + 1);
  else if (plan.period === "WEEK") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return end;
}
function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
function hashText(value) {
  const s = String(value || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}
function hexToRgba(hex, alpha) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(raw)) return `rgba(59,130,246,${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CHILD_VISUAL_THEMES = [
  { name: "Explorer", accent: "#0ea5e9", accentDark: "#0369a1", soft: "#e0f2fe" },
  { name: "Sprout", accent: "#16a34a", accentDark: "#166534", soft: "#dcfce7" },
  { name: "Sunbeam", accent: "#f59e0b", accentDark: "#b45309", soft: "#fef3c7" },
  { name: "Coral", accent: "#f97316", accentDark: "#c2410c", soft: "#ffedd5" },
  { name: "River", accent: "#3b82f6", accentDark: "#1e40af", soft: "#dbeafe" },
  { name: "Meadow", accent: "#22c55e", accentDark: "#15803d", soft: "#dcfce7" },
];

export default function TeacherChildDetailPage() {
  const router = useRouter();
  const childId = typeof router.query.id === "string" ? router.query.id : "";

  const [child, setChild] = useState(null);
  const [progressRows, setProgressRows] = useState([]);
  const [activities, setActivities] = useState([]);
  const [plans, setPlans] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [stepsDomain, setStepsDomain] = useState("");
  const [stepsAgeFilter, setStepsAgeFilter] = useState("");
  const [stepsSearch, setStepsSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("");

  const [reportTab, setReportTab] = useState("DAILY_REPORT");

  const [statusDraftById, setStatusDraftById] = useState({});
  const [savingProgressId, setSavingProgressId] = useState("");
  const [editingActivityId, setEditingActivityId] = useState("");
  const [editActivityType, setEditActivityType] = useState("OTHER");
  const [editActivityNotes, setEditActivityNotes] = useState("");
  const [editActivityGrade, setEditActivityGrade] = useState("");
  const [editActivityMediaUrls, setEditActivityMediaUrls] = useState([]);
  const [uploadingEditPhotos, setUploadingEditPhotos] = useState(false);
  const editPhotoInputRef = useRef(null);
  const [savingActivityId, setSavingActivityId] = useState("");
  const [deletingActivityId, setDeletingActivityId] = useState("");
  const [activityActionError, setActivityActionError] = useState("");
  const [activityActionSuccess, setActivityActionSuccess] = useState("");

  const [loading, setLoading] = useState(true);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    if (!childId) return;
    const rows = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`).catch(() => []);
    const safeRows = arr(rows);
    setProgressRows(safeRows);
    setStatusDraftById(Object.fromEntries(safeRows.map((p) => [p.id, p.status || "NOT_STARTED"])));
  }, [childId]);

  useEffect(() => {
    (async () => {
      if (!childId) return;
      setLoading(true);
      setError("");
      try {
        const [childRes, activityRes] = await Promise.all([
          apiJson(`/api/v1/children/${encodeURIComponent(childId)}`),
          apiJson(`/api/v1/activities?childId=${encodeURIComponent(childId)}`).catch(() => []),
        ]);
        setChild(childRes || null);
        setActivities(arr(activityRes));
        await loadProgress();
      } catch (e) {
        setError(e.message || "Failed to load child");
        setChild(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, loadProgress]);

  useEffect(() => {
    (async () => {
      if (!child?.centerId || !childId) {
        setPlans([]);
        setCompletions([]);
        return;
      }
      setStepsLoading(true);
      try {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - 120);
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 180);
        const planQs = new URLSearchParams({ centerId: child.centerId, from: from.toISOString(), to: to.toISOString() });
        const completionQs = new URLSearchParams({ childId, from: from.toISOString(), to: to.toISOString() });
        const [planRes, completionRes] = await Promise.all([
          apiJson(`/api/v1/milestone-checklists?${planQs.toString()}`),
          apiJson(`/api/v1/milestone-checklists/completions?${completionQs.toString()}`),
        ]);
        setPlans(arr(planRes));
        setCompletions(arr(completionRes));
      } catch {
        setPlans([]);
        setCompletions([]);
      } finally {
        setStepsLoading(false);
      }
    })();
  }, [child?.centerId, childId]);

  useEffect(() => {
    (async () => {
      if (!childId) { setAttendanceHistory([]); return; }
      setAttendanceLoading(true);
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const qs = new URLSearchParams({ childId, from: from.toISOString() });
        const res = await apiJson(`/api/v1/attendance/history?${qs.toString()}`);
        setAttendanceHistory(arr(res));
      } catch { setAttendanceHistory([]); }
      finally { setAttendanceLoading(false); }
    })();
  }, [childId]);

  async function saveProgressStatus(progressId) {
    const status = statusDraftById[progressId];
    if (!progressId || !status) return;
    setSavingProgressId(progressId);
    setError("");
    try {
      await apiJson(`/api/v1/progress/${encodeURIComponent(progressId)}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          achievedAt: ["COMPLETED", "PASSED"].includes(status) ? new Date().toISOString() : null,
        }),
      });
      await loadProgress();
    } catch (e) {
      setError(e.message || "Failed to update progress");
    } finally {
      setSavingProgressId("");
    }
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
        const idx = result.indexOf(",");
        if (idx === -1) return reject(new Error("Invalid file encoding"));
        resolve(result.slice(idx + 1));
      };
      reader.onabort = () => {
        clearTimeout(timer);
        reject(new Error("File read aborted"));
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadEditPhotos(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setUploadingEditPhotos(true);
    setActivityActionError("");
    try {
      const nextUrls = [];
      const issues = [];
      for (const file of files) {
        if (Number(file?.size || 0) > MAX_PHOTO_BYTES) {
          issues.push(`${file.name} exceeds 10MB`);
          continue;
        }
        try {
          const dataBase64 = await fileToBase64(file, 12000);
          const res = await apiJson("/api/v1/uploads", {
            method: "POST",
            timeoutMs: 25000,
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              dataBase64,
            }),
          });
          if (res?.url) nextUrls.push(res.url);
          else issues.push(`${file.name} upload did not return URL`);
        } catch (e) {
          issues.push(`${file.name} failed to upload`);
        }
      }
      if (nextUrls.length) {
        setEditActivityMediaUrls((cur) => [...new Set([...(cur || []), ...nextUrls])]);
      }
      if (issues.length) {
        setActivityActionError(`Some photos were skipped: ${issues.slice(0, 2).join("; ")}`);
      }
    } finally {
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
      setUploadingEditPhotos(false);
    }
  }

  function buildEditedActivityDetails(existingDetails) {
    const base = { ...asObject(existingDetails) };
    const nextMedia = arr(editActivityMediaUrls).filter(Boolean);
    const gradeNum = editActivityGrade === "" ? null : Number(editActivityGrade);
    const hasGrade = editActivityGrade !== "" && Number.isFinite(gradeNum);

    if (hasGrade) {
      base.kind = "DAILY_GRADE";
      base.grade = gradeNum;
    } else if (base.kind === "DAILY_GRADE") {
      delete base.kind;
      delete base.grade;
    }

    if (nextMedia.length) base.media = nextMedia;
    else delete base.media;
    delete base.photos;

    return Object.keys(base).length ? base : null;
  }

  function startEditActivity(activity) {
    setEditingActivityId(activity?.id || "");
    setEditActivityType(activity?.type || "OTHER");
    setEditActivityNotes(activity?.notes || "");
    setEditActivityGrade(extractDailyGrade(activity));
    setEditActivityMediaUrls(extractActivityMediaUrls(activity));
    setActivityActionError("");
    setActivityActionSuccess("");
  }

  function cancelEditActivity() {
    setEditingActivityId("");
    setEditActivityType("OTHER");
    setEditActivityNotes("");
    setEditActivityGrade("");
    setEditActivityMediaUrls([]);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
  }

  async function saveActivity(activityId) {
    if (!activityId) return;
    setSavingActivityId(activityId);
    setActivityActionError("");
    setActivityActionSuccess("");
    try {
      const existing = arr(activities).find((row) => row.id === activityId);
      const hasGrade = editActivityGrade !== "" && Number.isFinite(Number(editActivityGrade));
      const nextType = hasGrade ? "OTHER" : editActivityType;
      const nextDetails = buildEditedActivityDetails(existing?.details);
      const updated = await apiJson(`/api/v1/activities/${encodeURIComponent(activityId)}`, {
        method: "PUT",
        body: JSON.stringify({ type: nextType, notes: editActivityNotes, details: nextDetails }),
      });
      setActivities((cur) => cur.map((row) => (row.id === activityId ? updated : row)));
      setActivityActionSuccess("Log updated.");
      cancelEditActivity();
    } catch (e) {
      setActivityActionError(e.message || "Failed to update log");
    } finally {
      setSavingActivityId("");
    }
  }

  async function removeActivity(activityId) {
    if (!activityId) return;
    if (!confirm("Delete this log entry?")) return;
    setDeletingActivityId(activityId);
    setActivityActionError("");
    setActivityActionSuccess("");
    try {
      await apiJson(`/api/v1/activities/${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });
      setActivities((cur) => cur.filter((row) => row.id !== activityId));
      setActivityActionSuccess("Log removed.");
      if (editingActivityId === activityId) cancelEditActivity();
    } catch (e) {
      setActivityActionError(e.message || "Failed to remove log");
    } finally {
      setDeletingActivityId("");
    }
  }

  const childAgeGroupKey = useMemo(() => ageGroupKeyFromBirthDate(child?.birthDate), [child?.birthDate]);
  const isInfant = childAgeGroupKey === "0-1";
  const docsHealth = useMemo(() => arr(child?.healthAssessmentDocuments).filter((d) => d?.url), [child?.healthAssessmentDocuments]);
  const docsEnrollment = useMemo(() => arr(child?.enrollmentDocuments).filter((d) => d?.url), [child?.enrollmentDocuments]);

  const completionByItemId = useMemo(
    () => Object.fromEntries(arr(completions).map((c) => [c.itemId, c.completedAt || null])),
    [completions],
  );

  const stepRows = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (const plan of arr(plans)) {
      const start = plan?.periodStart ? new Date(plan.periodStart) : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      const dueAt = planEndDate(plan) || start;
      for (const item of arr(plan.items)) {
        const pc =
          item?.lessonGoal?.passingCriteria &&
          typeof item.lessonGoal.passingCriteria === "object" &&
          !Array.isArray(item.lessonGoal.passingCriteria)
            ? item.lessonGoal.passingCriteria
            : {};
        rows.push({
          id: `${plan.id}:${item.id}`,
          title: item.title || "Step",
          refId: String(pc.reference || ""),
          domain: item?.lesson?.category?.name || "Other",
          ageRange: item?.lesson?.category?.ageRange || "",
          ageGroupKey: mapAgeRangeToGroup(item?.lesson?.category?.ageRange),
          lessonId: item?.lessonGoal?.lessonId || item?.lessonId || item?.lesson?.id || "",
          goalIndex: item?.lessonGoal?.goalIndex || 0,
          dueAt,
          completedAt: completionByItemId[item.id] || null,
          recommended: arr(item?.lesson?.remediationsFrom).map((r) => r?.toLesson).filter(Boolean),
          isUpcoming: start > now,
          isOverdue: now >= dueAt && !completionByItemId[item.id],
        });
      }
    }
    return rows.filter((row) => {
      if (stepsDomain && row.domain !== stepsDomain) return false;
      if (stepsAgeFilter && row.ageGroupKey !== stepsAgeFilter) return false;
      const q = String(stepsSearch || "").trim().toLowerCase();
      if (!q) return true;
      return `${row.title} ${row.domain} ${row.ageRange}`.toLowerCase().includes(q);
    });
  }, [completionByItemId, plans, stepsAgeFilter, stepsDomain, stepsSearch]);

  const overdueSteps = useMemo(() => stepRows.filter((s) => s.isOverdue), [stepRows]);
  const upcomingSteps = useMemo(() => stepRows.filter((s) => s.isUpcoming && !s.completedAt), [stepRows]);
  const stepDomains = useMemo(() => [...new Set(stepRows.map((s) => s.domain))].sort(), [stepRows]);
  const completedSteps = useMemo(() => stepRows.filter((s) => !!s.completedAt), [stepRows]);
  const stepVisualByDomain = useMemo(() => {
    const by = new Map();
    for (const row of stepRows) {
      const key = row.domain || "Other";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(row);
    }
    return [...by.entries()]
      .map(([domain, rows]) => {
        const total = rows.length;
        const completed = rows.filter((r) => !!r.completedAt).length;
        const overdue = rows.filter((r) => r.isOverdue).length;
        const upcoming = rows.filter((r) => r.isUpcoming && !r.completedAt).length;
        return {
          domain,
          total,
          completed,
          overdue,
          upcoming,
          percent: pct(completed, total),
          rows: rows.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
        };
      })
      .sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));
  }, [stepRows]);
  const stepTimeline = useMemo(
    () =>
      [...stepRows]
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 60),
    [stepRows],
  );

  const currentProgressRows = useMemo(() => {
    const active = arr(progressRows).filter((p) => ["NOT_STARTED", "IN_PROGRESS", "FAILED"].includes(p?.status));
    if (!stepsDomain && !stepsAgeFilter) return active;
    return active.filter((p) =>
      stepRows.some((s) => s.lessonId === p.lessonId && Number(s.goalIndex || 0) === Number(p.goalIndex || 0)),
    );
  }, [progressRows, stepRows, stepsAgeFilter, stepsDomain]);

  // Catchup: merge overdue milestone items + FAILED/stale progress records
  const catchupItems = useMemo(() => {
    const items = [];
    const seen = new Set();
    // 1) Overdue milestone items
    for (const s of overdueSteps) {
      items.push({ type: "milestone", id: s.id, title: s.title, domain: s.domain, detail: `Overdue since ${formatDate(s.dueAt)}`, recommended: s.recommended, severity: "overdue" });
      if (s.lessonId) seen.add(`${s.lessonId}:${s.goalIndex}`);
    }
    // 2) FAILED progress records
    for (const p of arr(progressRows)) {
      if (p.status !== "FAILED") continue;
      const key = `${p.lessonId}:${p.goalIndex || 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ type: "progress", id: p.id, title: p.lesson?.title || "Lesson", domain: p.lesson?.category?.name || "General", detail: `Needs reteaching - marked as failed`, recommended: [], severity: "failed" });
    }
    // 3) IN_PROGRESS items that have been stale for over 14 days
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    for (const p of arr(progressRows)) {
      if (p.status !== "IN_PROGRESS") continue;
      const key = `${p.lessonId}:${p.goalIndex || 1}`;
      if (seen.has(key)) continue;
      const updated = new Date(p.updatedAt || p.createdAt);
      if (updated > twoWeeksAgo) continue;
      seen.add(key);
      items.push({ type: "progress", id: p.id, title: p.lesson?.title || "Lesson", domain: p.lesson?.category?.name || "General", detail: `In progress for ${Math.round((Date.now() - updated.getTime()) / 86400000)} days - may need extra support`, recommended: [], severity: "stale" });
    }
    return items;
  }, [overdueSteps, progressRows]);

  // Upcoming: merge future milestone items + NOT_STARTED progress records not already overdue
  const upcomingItems = useMemo(() => {
    const items = [];
    const seen = new Set();
    // 1) Upcoming milestone items
    for (const s of upcomingSteps) {
      items.push({ type: "milestone", id: s.id, title: s.title, domain: s.domain, detail: `${s.ageRange || "Any age"} | Due ${formatDate(s.dueAt)}` });
      if (s.lessonId) seen.add(`${s.lessonId}:${s.goalIndex}`);
    }
    // 2) NOT_STARTED progress records that aren't already in catchup
    for (const p of arr(progressRows)) {
      if (p.status !== "NOT_STARTED") continue;
      const key = `${p.lessonId}:${p.goalIndex || 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ type: "progress", id: p.id, title: p.lesson?.title || "Lesson", domain: p.lesson?.category?.name || "General", detail: `Step ${p.goalIndex || 1} - Not yet started` });
    }
    return items;
  }, [upcomingSteps, progressRows]);

  const filteredActivities = useMemo(
    () => arr(activities).filter((a) => (logTypeFilter ? a.type === logTypeFilter : true)),
    [activities, logTypeFilter],
  );
  const editingActivity = useMemo(
    () => arr(activities).find((a) => a.id === editingActivityId) || null,
    [activities, editingActivityId],
  );

  const reportActivities = useMemo(
    () =>
      [...arr(activities)]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20),
    [activities],
  );
  const reportProgress = useMemo(() => arr(progressRows), [progressRows]);
  const reportDiaperPotty = useMemo(
    () => reportActivities.filter((a) => a.type === "DIAPER_CHANGE").slice(0, 5),
    [reportActivities],
  );
  const reportMealsNutrition = useMemo(
    () => reportActivities.filter((a) => ["MEAL", "SNACK", "BOTTLE"].includes(a.type)).slice(0, 5),
    [reportActivities],
  );

  const childVisual = useMemo(() => {
    const seed = hashText(`${child?.id || ""}:${child?.firstName || ""}:${childAgeGroupKey}`);
    const theme = CHILD_VISUAL_THEMES[seed % CHILD_VISUAL_THEMES.length];
    const domainCounts = stepRows.reduce((acc, row) => {
      const k = row.domain || "Other";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const dominantDomain =
      Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
    const completionPct = pct(completedSteps.length, stepRows.length);
    let stage = "Developing";
    if (completionPct >= 75) stage = "Advanced";
    else if (completionPct >= 40) stage = "Growing";
    return {
      ...theme,
      dominantDomain,
      stage,
      gradient: `linear-gradient(135deg, ${hexToRgba(theme.accent, 0.16)} 0%, ${theme.soft} 48%, #ffffff 100%)`,
      ring: hexToRgba(theme.accent, 0.35),
    };
  }, [child?.firstName, child?.id, childAgeGroupKey, completedSteps.length, stepRows]);

  if (loading) {
    return (
      <TeacherLayout title="Child Profile">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading...</div>
      </TeacherLayout>
    );
  }

  if (!child) {
    return (
      <TeacherLayout title="Child Profile">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error || "Child not found."}
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title={`Child: ${fullName(child)}`}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Child Profile</div>
              <h2 className="mt-1 text-xl font-extrabold text-gray-900">{fullName(child)}</h2>
              <div className="mt-1 text-sm text-gray-600">
                DOB: {formatDate(child.birthDate)} | Age group: {AGE_GROUPS.find((g) => g.key === childAgeGroupKey)?.label || "Unknown"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/teacher/classroom" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50">Back to classroom</Link>
              <Link href={`/teacher/logs?centerId=${encodeURIComponent(child.centerId || "")}&childId=${encodeURIComponent(child.id)}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700">Daily logging</Link>
            </div>
          </div>
          {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard label="Name" value={fullName(child)} />
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Picture</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-800">{String(child.firstName || "?").slice(0, 1)}</div>
                  <div className="text-sm text-gray-600">Child photos are tracked in daily logs.</div>
                </div>
              </div>
              <InfoCard label="DOB" value={formatDate(child.birthDate)} />
              <InfoCard label="Parents" value={child.parent?.name || child.parent?.email || "No parent linked"} />
              <InfoCard label="Emergency contact" value={child.emergencyContact || "Not provided"} />
              <InfoCard label="Allergies" value={child.allergies || "None listed"} />
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Health assessment</div>
              {docsHealth.length ? (
                <ul className="mt-2 space-y-2">{docsHealth.map((doc, idx) => <li key={`${doc.url}-${idx}`}><a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:underline">{doc.originalName || `Document ${idx + 1}`}</a></li>)}</ul>
              ) : (
                <div className="mt-2 text-sm text-gray-600">No health assessment documents uploaded.</div>
              )}
            </div>

            {isInfant ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">0-1 years feeding plan</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>What they eat: {child?.feedingPlan?.foods || "Not set"}</div>
                  <div>Formula: {child?.feedingPlan?.formula || "Not set"}</div>
                  <div>Bottles/day: {child?.feedingPlan?.bottlesPerDay ?? "Not set"}</div>
                  <div>Bottle notes: {child?.feedingPlan?.bottleNotes || "Not set"}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enrollment documents</div>
            {docsEnrollment.length ? (
              <ul className="mt-3 space-y-2">{docsEnrollment.map((doc, idx) => <li key={`${doc.url}-${idx}`}><a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:underline">{doc.originalName || `Enrollment document ${idx + 1}`}</a></li>)}</ul>
            ) : (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">No enrollment documents uploaded.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Steps of progression</div>
              <div className="mt-1 text-sm text-gray-600">Current steps, overdue alerts, catchup plan, upcoming steps.</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ backgroundColor: childVisual.soft, color: childVisual.accentDark }}
                >
                  {childVisual.name} theme
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                  Focus: {childVisual.dominantDomain}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                  Stage: {childVisual.stage}
                </span>
              </div>
            </div>
            <Link href="/teacher/progress" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50">Open full progress manager</Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={stepsSearch} onChange={(e) => setStepsSearch(e.target.value)} placeholder="Search step..." className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <select value={stepsDomain} onChange={(e) => setStepsDomain(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All domains</option>{stepDomains.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <select value={stepsAgeFilter} onChange={(e) => setStepsAgeFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All ages</option>{AGE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
            <button type="button" onClick={() => { setStepsSearch(""); setStepsDomain(""); setStepsAgeFilter(""); }} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Reset filters</button>
          </div>

          {stepsLoading ? <div className="mt-3 text-sm text-gray-600">Loading progression steps...</div> : null}
          {overdueSteps.length ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Alert: {overdueSteps.length} step(s) are overdue and not signed off.</div> : null}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <VisualMetricCard title="Total milestones" value={stepRows.length} helper="All planned steps in range" accent={childVisual.accent} />
            <VisualMetricCard title="Completed" value={`${completedSteps.length} (${pct(completedSteps.length, stepRows.length)}%)`} helper="Signed-off milestones" accent={childVisual.accent} />
            <VisualMetricCard title="Overdue" value={overdueSteps.length} helper="Past due and not complete" accent={childVisual.accent} />
            <VisualMetricCard title="Upcoming" value={upcomingSteps.length} helper="Future planned milestones" accent={childVisual.accent} />
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 p-3" style={{ background: childVisual.gradient, boxShadow: `inset 0 0 0 1px ${childVisual.ring}` }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Milestone visual board</div>
            {stepVisualByDomain.length ? (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {stepVisualByDomain.map((bucket) => (
                  <div key={bucket.domain} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-gray-900">{bucket.domain}</div>
                      <div className="text-xs font-semibold text-gray-600">
                        {bucket.completed}/{bucket.total} complete
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${bucket.percent}%`, backgroundColor: childVisual.accent }} />
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      {bucket.overdue} overdue | {bucket.upcoming} upcoming
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {bucket.rows.slice(0, 8).map((row) => (
                        <span
                          key={row.id}
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            row.completedAt
                              ? "bg-green-100 text-green-800"
                              : row.isOverdue
                                ? "bg-red-100 text-red-800"
                                : row.isUpcoming
                                  ? "bg-amber-100 text-amber-800"
                                  : "",
                          ].join(" ")}
                          style={row.completedAt || row.isOverdue || row.isUpcoming ? undefined : { backgroundColor: childVisual.soft, color: childVisual.accentDark }}
                          title={`${row.refId ? `${row.refId} | ` : ""}${row.title}`}
                        >
                          {row.refId || row.title}
                        </span>
                      ))}
                      {bucket.rows.length > 8 ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                          +{bucket.rows.length - 8}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-600">No milestones match this filter.</div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Milestone timeline</div>
            {stepTimeline.length ? (
              <div className="mt-2 space-y-2">
                {stepTimeline.map((row) => (
                  <div key={`${row.id}-timeline`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {row.refId ? `${row.refId} - ` : ""}{row.title}
                      </div>
                      <div className="text-xs text-gray-600">{row.domain} | Due {formatDate(row.dueAt)}</div>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        row.completedAt
                          ? "bg-green-100 text-green-800"
                          : row.isOverdue
                            ? "bg-red-100 text-red-800"
                            : row.isUpcoming
                              ? "bg-amber-100 text-amber-800"
                              : "",
                      ].join(" ")}
                      style={row.completedAt || row.isOverdue || row.isUpcoming ? undefined : { backgroundColor: childVisual.soft, color: childVisual.accentDark }}
                    >
                      {row.completedAt ? `Completed ${formatDate(row.completedAt)}` : row.isOverdue ? "Overdue" : row.isUpcoming ? "Upcoming" : "In progress"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-600">No milestone timeline entries.</div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Current steps working on */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current steps working on</div>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{currentProgressRows.length}</span>
              </div>
              {currentProgressRows.length ? (
                <div className="mt-2 space-y-2">
                  {currentProgressRows.slice(0, 20).map((p) => {
                    const busy = savingProgressId === p.id;
                    const statusClass = p.status === "FAILED" ? "border-rose-200 bg-rose-50" : p.status === "IN_PROGRESS" ? "border-sky-200 bg-sky-50/50" : "border-gray-200 bg-white";
                    return (
                      <div key={p.id} className={["rounded-lg border p-3", statusClass].join(" ")}>
                        <div className="text-sm font-extrabold text-gray-900">{p.lesson?.title || "Lesson"}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                          <span>Step {p.goalIndex || 1}</span>
                          <span className={["rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            p.status === "FAILED" ? "bg-rose-100 text-rose-700" : p.status === "IN_PROGRESS" ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600",
                          ].join(" ")}>{p.status === "FAILED" ? "Needs Support" : p.status === "IN_PROGRESS" ? "In Progress" : "Not Started"}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={statusDraftById[p.id] || "NOT_STARTED"}
                            onChange={(e) => setStatusDraftById((cur) => ({ ...cur, [p.id]: e.target.value }))}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
                            disabled={busy}
                          >
                            {PROGRESS_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                          </select>
                          {(statusDraftById[p.id] || p.status) !== p.status && (
                            <button type="button" onClick={() => saveProgressStatus(p.id)} disabled={busy} className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60">
                              {busy ? "..." : "Save"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-600">No active progress records for this filter.</div>
              )}
            </div>

            {/* Catchup plan */}
            <div className={["rounded-xl border p-3", catchupItems.length ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"].join(" ")}>
              <div className="flex items-center justify-between">
                <div className={["text-xs font-semibold uppercase tracking-wide", catchupItems.length ? "text-red-700" : "text-gray-500"].join(" ")}>
                  Catchup plan (auto generated)
                </div>
                {catchupItems.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">{catchupItems.length}</span>
                )}
              </div>
              {catchupItems.length ? (
                <div className="mt-2 space-y-2">
                  {catchupItems.slice(0, 20).map((item) => {
                    const borderClass = item.severity === "failed" ? "border-rose-200 bg-white" : item.severity === "stale" ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-white";
                    return (
                      <div key={item.id} className={["rounded-lg border p-3", borderClass].join(" ")}>
                        <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className={["rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            item.severity === "failed" ? "bg-rose-100 text-rose-700" : item.severity === "stale" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
                          ].join(" ")}>
                            {item.severity === "failed" ? "Failed" : item.severity === "stale" ? "Stale" : "Overdue"}
                          </span>
                          <span className="text-gray-500">{item.domain}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">{item.detail}</div>
                        {item.recommended?.length ? (
                          <div className="mt-2 text-xs text-gray-700">
                            Suggested: {item.recommended.map((l) => l.title).join(", ")}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">Schedule remediation and additional practice.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm font-semibold text-emerald-700">
                  All on track - no catchup needed.
                </div>
              )}
            </div>

            {/* Upcoming steps */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming &amp; not started</div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{upcomingItems.length}</span>
              </div>
              {upcomingItems.length ? (
                <div className="mt-2 space-y-2">
                  {upcomingItems.slice(0, 20).map((item) => (
                    <div key={item.id} className={["rounded-lg border p-3", item.type === "progress" ? "border-sky-200 bg-sky-50/30" : "border-gray-200 bg-white"].join(" ")}>
                      <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-gray-500">{item.domain}</span>
                        {item.type === "progress" && (
                          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">From progress</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">{item.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-600">No upcoming steps for this filter.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Daily logging (Procare-style)
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Use the activity logger and review recent entries.
              </div>
            </div>
            <Link
              href={`/teacher/logs?centerId=${encodeURIComponent(child.centerId || "")}&childId=${encodeURIComponent(child.id)}`}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              Log activity now
            </Link>
          </div>

          <div className="mt-3">
            <select
              value={logTypeFilter}
              onChange={(e) => setLogTypeFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All log types</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {activityActionError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {activityActionError}
            </div>
          ) : null}
          {activityActionSuccess ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {activityActionSuccess}
            </div>
          ) : null}

          {filteredActivities.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredActivities.slice(0, 30).map((a) => {
                    const isSaving = savingActivityId === a.id;
                    const isDeleting = deletingActivityId === a.id;
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3 text-gray-600">{formatDateTime(a.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{a.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className="text-gray-700">{a.notes || "-"}</span>
                            {extractDomains(a) ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(extractDomains(a)).map(([k, v]) => (
                                  <span key={k} className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${LEVEL_BADGE[v] || "bg-gray-100 text-gray-700"}`}>
                                    {DOMAIN_LABELS[k] || k}: {LEVEL_NAMES[v] || v}
                                  </span>
                                ))}
                              </div>
                            ) : extractDailyGrade(a) ? (
                              <div className="text-xs font-semibold text-emerald-700">
                                Grade: {extractDailyGrade(a)}/5
                              </div>
                            ) : null}
                            {extractActivityMediaUrls(a).length ? (
                              <div className="grid grid-cols-3 gap-1">
                                {extractActivityMediaUrls(a).slice(0, 3).map((url, idx) => (
                                  <img
                                    key={`${a.id}-media-${idx}`}
                                    src={url}
                                    alt={`Activity media ${idx + 1}`}
                                    className="h-12 w-full rounded border border-gray-200 object-cover"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditActivity(a)}
                              disabled={isSaving || isDeleting}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeActivity(a.id)}
                              disabled={isSaving || isDeleting}
                              className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? "Removing..." : "Remove"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              No activity logs found for the selected filter.
            </div>
          )}

          {editingActivity ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3">
              <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Edit Activity Log</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {formatDateTime(editingActivity.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={cancelEditActivity}
                    disabled={savingActivityId === editingActivity.id || uploadingEditPhotos}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Type
                    </div>
                    <select
                      value={editActivityType}
                      onChange={(e) => setEditActivityType(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      disabled={savingActivityId === editingActivity.id}
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Daily grade
                    </div>
                    <select
                      value={editActivityGrade}
                      onChange={(e) => setEditActivityGrade(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      disabled={savingActivityId === editingActivity.id}
                    >
                      <option value="">(none)</option>
                      {[1, 2, 3, 4, 5].map((g) => (
                        <option key={g} value={String(g)}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-2 block">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Notes
                  </div>
                  <input
                    value={editActivityNotes}
                    onChange={(e) => setEditActivityNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    placeholder="Notes"
                    disabled={savingActivityId === editingActivity.id}
                  />
                </label>

                <div className="mt-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Photos
                  </div>
                  <input
                    ref={editPhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadEditPhotos(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => editPhotoInputRef.current?.click()}
                    disabled={savingActivityId === editingActivity.id || uploadingEditPhotos}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingEditPhotos ? "Uploading..." : "Add photos"}
                  </button>
                  {arr(editActivityMediaUrls).length ? (
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {arr(editActivityMediaUrls).slice(0, 9).map((url, idx) => (
                        <div key={`${url}-${idx}`} className="overflow-hidden rounded border border-gray-200 bg-white">
                          <img src={url} alt={`Activity media ${idx + 1}`} className="h-16 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditActivityMediaUrls((cur) => cur.filter((_, i) => i !== idx))}
                            disabled={savingActivityId === editingActivity.id}
                            className="w-full border-t border-gray-200 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500">No photos attached.</div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEditActivity}
                    disabled={savingActivityId === editingActivity.id || uploadingEditPhotos}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveActivity(editingActivity.id)}
                    disabled={savingActivityId === editingActivity.id || uploadingEditPhotos}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingActivityId === editingActivity.id ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reports (autopopulated)
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Daily report, progress report, steps of progression, catch-up plans, and milestone calendar.
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
            {[
              { key: "DAILY_REPORT", label: "Daily Report" },
              { key: "GRADES", label: "Grades" },
              { key: "PROGRESS_REPORT", label: "Progress Report" },
              { key: "STEPS", label: "Steps of Progression" },
              { key: "CATCHUP", label: "Catch-up Plans" },
              { key: "ATTENDANCE", label: "Attendance" },
              { key: "MILESTONE", label: "Milestone Calendar" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReportTab(tab.key)}
                className={[
                  "rounded-xl px-3 py-2 text-xs font-semibold",
                  reportTab === tab.key
                    ? "bg-sky-100 text-sky-900"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              {reportTab === "DAILY_REPORT" ? (
                <TeacherDailyReportPanel activities={reportActivities} loading={loading} />
              ) : null}
              {reportTab === "GRADES" ? (
                <TeacherGradesPanel activities={activities} loading={loading} />
              ) : null}
              {reportTab === "PROGRESS_REPORT" ? (
                <TeacherProgressReportPanel progressRows={reportProgress} loading={loading} childId={childId} />
              ) : null}
              {reportTab === "STEPS" ? (
                <TeacherStepsProgressionPanel
                  progressRows={reportProgress}
                  loading={loading}
                  childName={child.firstName}
                  statusDraftById={statusDraftById}
                  setStatusDraftById={setStatusDraftById}
                  saveProgressStatus={saveProgressStatus}
                  savingProgressId={savingProgressId}
                />
              ) : null}
              {reportTab === "CATCHUP" ? (
                <CatchupPlansPanel
                  progressRows={reportProgress}
                  childName={child.firstName}
                  birthDate={child.birthDate}
                />
              ) : null}
              {reportTab === "ATTENDANCE" ? (
                <ChildAttendancePanel
                  records={attendanceHistory}
                  loading={attendanceLoading}
                  childName={child.firstName}
                />
              ) : null}
            {reportTab === "MILESTONE" ? (
              <MilestoneCalendarPanel
                activities={reportActivities}
                progressRows={reportProgress}
                childName={child.firstName}
                noteLabel="Teacher's Note"
              />
            ) : null}
            </div>
            <aside className="space-y-3">
              <TeacherCarePanel title="Diaper / Potty" items={reportDiaperPotty} />
              <TeacherCarePanel title="Meals & Nutrition" items={reportMealsNutrition} />
              <Link
                href={`/teacher/logs?centerId=${encodeURIComponent(child.centerId || "")}&childId=${encodeURIComponent(child.id)}`}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-sky-700"
              >
                Go to Logging
              </Link>
            </aside>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-gray-900">{value}</div>
    </div>
  );
}

function TeacherDailyReportPanel({ activities, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Loading report...
      </div>
    );
  }
  if (!arr(activities).length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No daily activities yet for this child.
      </div>
    );
  }

  const photoItems = arr(activities)
    .flatMap((a) =>
      extractActivityMediaUrls(a).map((url, idx) => ({
        key: `${a.id || a.createdAt || "activity"}-${idx}`,
        url,
        createdAt: a.createdAt,
      })),
    )
    .slice(0, 18);

  return (
    <div className="space-y-3">
      {photoItems.length ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-extrabold text-gray-900">Photos</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photoItems.map((item, index) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                title={formatDateTime(item.createdAt)}
              >
                <img
                  src={item.url}
                  alt={`Child activity photo ${index + 1}`}
                  className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
                />
              </a>
            ))}
          </div>
        </div>
      ) : null}
      {arr(activities).slice(0, 20).map((a, index) => (
        <div
          key={a.id || `${a.createdAt}-${index}`}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-gray-900">
              {teacherActivityTitle(a, index)}
            </div>
            <div className="text-xs text-gray-500">{formatDateTime(a.createdAt)}</div>
          </div>
          <div className="mt-2 text-xs font-semibold text-sky-700">
            Type: {teacherFormatActivityType(a.type)}
          </div>
          {teacherRenderActivityDetails(a)}
          <div className="mt-2 text-sm text-gray-700">
            {a.notes && String(a.notes).trim()
              ? a.notes
              : "No note entered by teacher for this log."}
          </div>
          <div className="mt-3 text-xs font-semibold text-gray-500">
            {a.recordedBy?.name || a.recordedBy?.email || "Teacher update"}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeacherProgressReportPanel({ progressRows, loading, childId }) {
  const domainStats = useMemo(() => {
    const config = [
      { name: "Cognitive", barClass: "bg-sky-400" },
      { name: "Social-Emotional", barClass: "bg-emerald-400" },
      { name: "Physical", barClass: "bg-amber-400" },
      { name: "Language & Literacy", barClass: "bg-pink-400" },
    ];
    const byDomain = Object.fromEntries(
      config.map((item) => [item.name, { total: 0, complete: 0, barClass: item.barClass }]),
    );
    arr(progressRows).forEach((row) => {
      const domain = teacherInferDomain(row);
      if (!byDomain[domain]) return;
      byDomain[domain].total += 1;
      if (teacherIsCompletedStatus(row.status)) byDomain[domain].complete += 1;
    });
    return config.map((item) => {
      const stat = byDomain[item.name];
      const score = stat.total ? Math.round((stat.complete / stat.total) * 100) : 0;
      return { name: item.name, score, barClass: item.barClass };
    });
  }, [progressRows]);

  const milestoneCards = useMemo(() => {
    const now = new Date();
    const inMonth = arr(progressRows).filter((row) => {
      if (!teacherIsCompletedStatus(row.status)) return false;
      const sourceDate = row.achievedAt || row.updatedAt || row.createdAt;
      const date = new Date(sourceDate);
      return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const source = inMonth.length ? inMonth : arr(progressRows).filter((row) => teacherIsCompletedStatus(row.status));
    return source.slice(0, 3).map((row, index) => ({
      title: row.lesson?.title || `Milestone ${index + 1}`,
      detail: row.lesson?.description || `Goal ${row.goalIndex || 1}`,
      status: `Achieved ${formatDate(row.achievedAt || row.updatedAt || row.createdAt)}`,
    }));
  }, [progressRows]);

  const completionRatio = useMemo(() => {
    const total = arr(progressRows).length;
    if (!total) return 0;
    const done = arr(progressRows).filter((row) => teacherIsCompletedStatus(row.status)).length;
    return Math.round((done / total) * 100);
  }, [progressRows]);

  const moodLabel =
    completionRatio >= 70 ? "Sunny & Active" : completionRatio >= 35 ? "Focused & Growing" : "Building Momentum";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-extrabold text-gray-900">Developmental Domains</h4>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Today's mood: {moodLabel}
          </div>
        </div>

        {loading ? <div className="mt-3 text-sm text-gray-600">Loading progress records...</div> : null}

        <div className="mt-3 space-y-3">
          {domainStats.map((domain) => (
            <TeacherProgressDomainBar
              key={domain.name}
              label={domain.name}
              value={domain.score}
              barClass={domain.barClass}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span>Comparison based on age-appropriate milestone for 18-24 months</span>
          <span>{formatDateTime(new Date())}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-extrabold text-gray-900">Milestones Achieved This Month</h4>
          <Link
            href={`/teacher/reports?childId=${encodeURIComponent(childId || "")}`}
            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            View all Milestone History
          </Link>
        </div>
        {loading ? (
          <div className="mt-3 text-sm text-gray-600">Loading milestones...</div>
        ) : milestoneCards.length ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {milestoneCards.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                <div className="mt-1 text-xs text-gray-600">{item.detail}</div>
                <div className="mt-2 text-xs font-semibold text-sky-700">{item.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No completed milestone records found yet.
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherStepsProgressionPanel({ progressRows, loading, childName, statusDraftById, setStatusDraftById, saveProgressStatus, savingProgressId }) {
  const [filter, setFilter] = useState("ALL");

  const sorted = useMemo(() => [...arr(progressRows)].sort(
    (a, b) => {
      // Sort: FAILED first, then IN_PROGRESS, NOT_STARTED, then COMPLETED/PASSED last
      const order = { FAILED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, COMPLETED: 3, PASSED: 3 };
      const oa = order[a.status] ?? 2;
      const ob = order[b.status] ?? 2;
      if (oa !== ob) return oa - ob;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    },
  ), [progressRows]);

  const counts = useMemo(() => sorted.reduce(
    (acc, row) => {
      const s = String(row?.status || "");
      if (s === "COMPLETED" || s === "PASSED") acc.done += 1;
      else if (s === "IN_PROGRESS") acc.inProgress += 1;
      else if (s === "FAILED") acc.needsSupport += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { done: 0, inProgress: 0, needsSupport: 0, notStarted: 0 },
  ), [sorted]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return sorted;
    if (filter === "DONE") return sorted.filter((r) => r.status === "COMPLETED" || r.status === "PASSED");
    if (filter === "IN_PROGRESS") return sorted.filter((r) => r.status === "IN_PROGRESS");
    if (filter === "FAILED") return sorted.filter((r) => r.status === "FAILED");
    if (filter === "NOT_STARTED") return sorted.filter((r) => r.status === "NOT_STARTED");
    return sorted;
  }, [sorted, filter]);

  const totalSteps = sorted.length;
  const completionPct = totalSteps ? Math.round((counts.done / totalSteps) * 100) : 0;

  const isDone = (status) => status === "COMPLETED" || status === "PASSED";

  const filterTabs = [
    { key: "ALL", label: "All", count: totalSteps, border: "border-gray-200", bg: "bg-white", text: "text-gray-700", activeBg: "bg-gray-900", activeText: "text-white" },
    { key: "FAILED", label: "Needs Support", count: counts.needsSupport, border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700", activeBg: "bg-rose-600", activeText: "text-white" },
    { key: "IN_PROGRESS", label: "In Progress", count: counts.inProgress, border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-700", activeBg: "bg-sky-600", activeText: "text-white" },
    { key: "NOT_STARTED", label: "Not Started", count: counts.notStarted, border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-600", activeBg: "bg-gray-600", activeText: "text-white" },
    { key: "DONE", label: "Completed", count: counts.done, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", activeBg: "bg-emerald-600", activeText: "text-white" },
  ];

  function statusLabel(status) {
    if (status === "COMPLETED") return "Completed";
    if (status === "PASSED") return "Passed";
    if (status === "IN_PROGRESS") return "In Progress";
    if (status === "FAILED") return "Needs Support";
    return "Not Started";
  }

  function rowBorder(status) {
    if (status === "COMPLETED" || status === "PASSED") return "border-emerald-200 bg-emerald-50/50";
    if (status === "IN_PROGRESS") return "border-sky-200 bg-sky-50/50";
    if (status === "FAILED") return "border-rose-200 bg-rose-50/50";
    return "border-gray-200 bg-gray-50";
  }

  function pillStyle(status) {
    if (status === "COMPLETED" || status === "PASSED") return "bg-emerald-100 text-emerald-800";
    if (status === "IN_PROGRESS") return "bg-sky-100 text-sky-800";
    if (status === "FAILED") return "bg-rose-100 text-rose-800";
    return "bg-gray-100 text-gray-700";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-base font-extrabold text-gray-900">Steps of Progression</h4>
      <p className="mt-1 text-sm text-gray-600">
        Track and grade progress records for {childName || "this child"}. Use the dropdown to update status.
      </p>

      {loading ? (
        <div className="mt-3 text-sm text-gray-600">Loading progression steps...</div>
      ) : sorted.length === 0 ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No progression records yet.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Overall progress bar */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Overall Progress</span>
              <span>{counts.done}/{totalSteps} completed ({completionPct}%)</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Done</div>
              <div className="mt-1 text-xl font-extrabold text-emerald-900">{counts.done}</div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">In Progress</div>
              <div className="mt-1 text-xl font-extrabold text-sky-900">{counts.inProgress}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Needs Support</div>
              <div className="mt-1 text-xl font-extrabold text-rose-900">{counts.needsSupport}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Not Started</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">{counts.notStarted}</div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={[
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                    active
                      ? `${tab.activeBg} ${tab.activeText} border-transparent`
                      : `${tab.bg} ${tab.text} ${tab.border} hover:opacity-80`,
                  ].join(" ")}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No steps match this filter.
              </div>
            ) : filtered.slice(0, 30).map((row) => {
              const done = isDone(row.status);
              const busy = savingProgressId === row.id;
              const draftStatus = statusDraftById?.[row.id] || row.status || "NOT_STARTED";
              return (
                <div key={row.id} className={["rounded-xl border p-3 transition", rowBorder(row.status)].join(" ")}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox indicator */}
                    <div className={[
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                      done
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : row.status === "IN_PROGRESS"
                          ? "border-sky-300 bg-sky-100 text-sky-600"
                          : row.status === "FAILED"
                            ? "border-rose-300 bg-rose-100 text-rose-600"
                            : "border-gray-300 bg-white text-gray-400",
                    ].join(" ")}>
                      {done ? "\u2713" : row.status === "FAILED" ? "!" : ""}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={["text-sm font-extrabold", done ? "text-gray-500 line-through" : "text-gray-900"].join(" ")}>
                            {row.lesson?.title || row.lessonId}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {row.lesson?.category?.name || teacherInferDomain(row)} &middot; Step {row.goalIndex || 1}
                            {row.achievedAt ? ` \u00b7 Done ${formatDate(row.achievedAt)}` : ""}
                          </div>
                        </div>
                        <span className={["shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", pillStyle(row.status)].join(" ")}>
                          {statusLabel(row.status)}
                        </span>
                      </div>

                      {/* Inline status update */}
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={draftStatus}
                          onChange={(e) => setStatusDraftById?.((cur) => ({ ...cur, [row.id]: e.target.value }))}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
                          disabled={busy}
                        >
                          {PROGRESS_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                        {draftStatus !== row.status && (
                          <button
                            type="button"
                            onClick={() => saveProgressStatus?.(row.id)}
                            disabled={busy}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {busy ? "Saving..." : "Save"}
                          </button>
                        )}
                        <span className="text-[10px] text-gray-400">
                          Updated {formatDateTime(row.updatedAt || row.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length > 30 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center text-xs text-gray-500">
                Showing 30 of {filtered.length} steps
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherGradesPanel({ activities, loading }) {
  const assessments = useMemo(() => {
    const result = [];
    for (const a of arr(activities)) {
      const details = asObject(a?.details);
      if (details.kind !== "DAILY_GRADE") continue;
      const domains = details.domains || null;
      const grade = Number.isFinite(Number(details.grade)) ? Number(details.grade) : null;
      const domainAvg = details.domainAvg != null ? Number(details.domainAvg) : null;
      result.push({
        id: a.id,
        createdAt: a.createdAt,
        notes: a.notes || "",
        grade,
        domains,
        domainAvg,
      });
    }
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return result;
  }, [activities]);

  const domainAverages = useMemo(() => {
    const sums = {};
    const counts = {};
    for (const a of assessments) {
      if (!a.domains) continue;
      for (const [key, val] of Object.entries(a.domains)) {
        if (!Number.isFinite(val)) continue;
        sums[key] = (sums[key] || 0) + val;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const keys = ["cognitive", "social", "physical", "language", "creative"];
    return keys.map((key) => ({
      key,
      label: DOMAIN_LABELS[key] || key,
      avg: counts[key] ? sums[key] / counts[key] : null,
      count: counts[key] || 0,
    }));
  }, [assessments]);

  const overallAvg = useMemo(() => {
    const withDomains = assessments.filter((a) => a.domainAvg != null);
    if (!withDomains.length) return null;
    const sum = withDomains.reduce((s, a) => s + a.domainAvg, 0);
    return sum / withDomains.length;
  }, [assessments]);

  const domainAssessmentCount = assessments.filter((a) => a.domains).length;
  const legacyCount = assessments.filter((a) => !a.domains && a.grade !== null).length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Loading grades...
      </div>
    );
  }

  if (!assessments.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No developmental assessments logged yet. Use the Activity Logger to record grades.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Total Assessments</div>
          <div className="mt-1 text-xl font-extrabold text-sky-900">{assessments.length}</div>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Overall Level</div>
          <div className="mt-1 text-xl font-extrabold text-violet-900">
            {overallAvg !== null ? LEVEL_NAMES[Math.round(overallAvg)] || `${overallAvg.toFixed(1)}/4` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Domain Grades</div>
          <div className="mt-1 text-xl font-extrabold text-emerald-900">{domainAssessmentCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Legacy Grades</div>
          <div className="mt-1 text-xl font-extrabold text-gray-900">{legacyCount}</div>
        </div>
      </div>

      {/* Domain Averages */}
      {domainAssessmentCount > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h4 className="text-base font-extrabold text-gray-900">Domain Averages</h4>
          <p className="mt-1 text-xs text-gray-500">
            Averaged across {domainAssessmentCount} assessment{domainAssessmentCount !== 1 ? "s" : ""}.
          </p>
          <div className="mt-3 space-y-3">
            {domainAverages.map((d) => {
              const avg = d.avg;
              const levelLabel = avg !== null ? LEVEL_NAMES[Math.round(avg)] || `${avg.toFixed(1)}/4` : "No data";
              const barPct = avg !== null ? Math.round((avg / 4) * 100) : 0;
              const barColor =
                avg !== null
                  ? avg >= 3.5
                    ? "bg-violet-500"
                    : avg >= 2.5
                      ? "bg-emerald-500"
                      : avg >= 1.5
                        ? "bg-sky-500"
                        : "bg-amber-500"
                  : "bg-gray-300";
              return (
                <div key={d.key}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-700">{d.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${avg !== null ? (LEVEL_BADGE[Math.round(avg)] || "bg-gray-100 text-gray-700") : "bg-gray-100 text-gray-500"}`}>
                      {levelLabel}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assessment History */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h4 className="text-base font-extrabold text-gray-900">Assessment History</h4>
        <p className="mt-1 text-xs text-gray-500">All recorded grades, most recent first.</p>
        <div className="mt-3 space-y-2">
          {assessments.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-gray-900">
                  {a.domains ? "Developmental Assessment" : "Daily Grade"}
                </div>
                <div className="text-xs text-gray-500">{formatDateTime(a.createdAt)}</div>
              </div>
              {a.domains ? (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(a.domains).map(([k, v]) => (
                      <span
                        key={k}
                        className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE[v] || "bg-gray-100 text-gray-700"}`}
                      >
                        {DOMAIN_LABELS[k] || k}: {LEVEL_NAMES[v] || v}
                      </span>
                    ))}
                  </div>
                  {a.domainAvg != null && (
                    <div className="mt-1.5 text-xs font-semibold text-gray-600">
                      Overall: {LEVEL_NAMES[Math.round(a.domainAvg)] || `${a.domainAvg.toFixed(1)}/4`}
                    </div>
                  )}
                </div>
              ) : a.grade !== null ? (
                <div className="mt-2 text-xs font-semibold text-emerald-700">Grade: {a.grade}/5</div>
              ) : null}
              {a.notes ? (
                <div className="mt-2 line-clamp-2 text-xs text-gray-600">{a.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function teacherActivityTitle(activity, index) {
  if (activity?.type === "ACTIVITY") return "Teacher's Summary";
  if (activity?.type === "OTHER" && activity?.details?.kind === "DAILY_GRADE") {
    return activity?.details?.domains ? "Developmental Assessment" : "Daily Grade";
  }
  if (activity?.type === "MEAL" || activity?.type === "SNACK" || activity?.type === "BOTTLE") return "Meals & Nutrition";
  if (activity?.type === "DIAPER_CHANGE") return "Diaper / Potty";
  if (activity?.type === "NAP") return "Rest Time";
  return `${teacherFormatActivityType(activity?.type) || "Update"} ${index + 1}`;
}

function teacherFormatActivityType(type) {
  return String(type || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function teacherRenderActivityDetails(activity) {
  const details = asObject(activity?.details);
  const grade =
    details.kind === "DAILY_GRADE" && Number.isFinite(Number(details.grade))
      ? Number(details.grade)
      : null;
  const domains = details.kind === "DAILY_GRADE" && details.domains ? details.domains : null;
  const media = extractActivityMediaUrls(activity);
  return (
    <>
      {domains ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {Object.entries(domains).map(([k, v]) => (
              <span key={k} className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE[v] || "bg-gray-100 text-gray-700"}`}>
                {DOMAIN_LABELS[k] || k}: {LEVEL_NAMES[v] || v}
              </span>
            ))}
          </div>
          {details.domainAvg != null && (
            <div className="mt-1 text-xs text-gray-600">
              Overall: {LEVEL_NAMES[Math.round(details.domainAvg)] || details.domainAvg + "/4"}
            </div>
          )}
        </div>
      ) : grade !== null ? (
        <div className="mt-2 text-xs font-semibold text-emerald-700">Daily grade: {grade}/5</div>
      ) : null}
      {media.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.slice(0, 3).map((url, idx) => (
            <img
              key={`${activity?.id || activity?.createdAt || "activity"}-media-${idx}`}
              src={url}
              alt={`Activity media ${idx + 1}`}
              className="h-24 w-full rounded-lg border border-gray-200 object-cover"
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function TeacherProgressDomainBar({ label, value, barClass }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-700">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div className={["h-full rounded-full", barClass].join(" ")} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function teacherIsCompletedStatus(status) {
  return status === "COMPLETED" || status === "PASSED";
}

function teacherInferDomain(row) {
  const categoryName = String(row?.lesson?.category?.name || "").toLowerCase();
  const lessonTitle = String(row?.lesson?.title || "").toLowerCase();
  const text = `${categoryName} ${lessonTitle}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior")) return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement")) return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics")) {
    return "Language & Literacy";
  }
  return "Cognitive";
}

function TeacherCarePanel({ title, items }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-extrabold text-gray-900">{title}</h4>
      {arr(items).length ? (
        <div className="mt-2 space-y-2">
          {arr(items).map((row, index) => (
            <div
              key={row.id || `${row.createdAt}-${index}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-2"
            >
              <div className="text-xs font-semibold text-gray-800">
                {teacherFormatTime(row.createdAt)}
              </div>
              <div className="mt-1 text-xs text-gray-600">{row.notes || "Update logged"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-600">No recent updates.</div>
      )}
    </div>
  );
}

function teacherFormatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChildAttendancePanel({ records, loading, childName }) {
  const sorted = useMemo(
    () => [...arr(records)].sort((a, b) => new Date(b.day) - new Date(a.day)),
    [records],
  );

  const stats = useMemo(() => {
    const total = sorted.length;
    let present = 0;
    let late = 0;
    let totalHours = 0;
    let countWithHours = 0;
    for (const r of sorted) {
      if (r.checkedInAt) {
        present += 1;
        const inTime = new Date(r.checkedInAt);
        if (inTime.getHours() >= 9) late += 1;
        if (r.checkedOutAt) {
          const outTime = new Date(r.checkedOutAt);
          const diff = (outTime - inTime) / (1000 * 60 * 60);
          if (diff > 0 && diff < 24) {
            totalHours += diff;
            countWithHours += 1;
          }
        }
      }
    }
    const avgHours = countWithHours ? totalHours / countWithHours : 0;
    return { total, present, absent: total - present, late, avgHours, onTime: present - late };
  }, [sorted]);

  const byWeek = useMemo(() => {
    const weeks = new Map();
    for (const r of sorted) {
      const d = new Date(r.day);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!weeks.has(key)) weeks.set(key, { week: key, records: [] });
      weeks.get(key).records.push(r);
    }
    return [...weeks.values()];
  }, [sorted]);

  const attendanceRate = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;

  function fmtDay(v) {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtTime(v) {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function duration(inAt, outAt) {
    if (!inAt || !outAt) return "-";
    const diff = (new Date(outAt) - new Date(inAt)) / (1000 * 60);
    if (diff <= 0 || diff > 1440) return "-";
    const h = Math.floor(diff / 60);
    const m = Math.round(diff % 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  if (loading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading attendance records...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h4 className="text-base font-extrabold text-gray-900">Attendance History</h4>
        <p className="mt-1 text-sm text-gray-600">
          {childName ? `Attendance records for ${childName}` : "Attendance records"} (last 3 months).
        </p>

        {sorted.length === 0 ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No attendance records found.
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Present</div>
                <div className="mt-1 text-xl font-extrabold text-emerald-900">{stats.present}</div>
                <div className="text-[10px] text-emerald-600">{attendanceRate}% rate</div>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Absent</div>
                <div className="mt-1 text-xl font-extrabold text-rose-900">{stats.absent}</div>
                <div className="text-[10px] text-rose-600">{stats.total} total days</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">On Time</div>
                <div className="mt-1 text-xl font-extrabold text-amber-900">{stats.onTime}</div>
                <div className="text-[10px] text-amber-600">{stats.late} late (after 9am)</div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Avg Hours</div>
                <div className="mt-1 text-xl font-extrabold text-sky-900">{stats.avgHours ? stats.avgHours.toFixed(1) : "-"}</div>
                <div className="text-[10px] text-sky-600">per day present</div>
              </div>
            </div>

            {/* Attendance rate bar */}
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span>Attendance Rate</span>
                <span>{attendanceRate}%</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={["h-full rounded-full transition-all", attendanceRate >= 90 ? "bg-emerald-500" : attendanceRate >= 75 ? "bg-amber-500" : "bg-rose-500"].join(" ")}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>

            {/* Weekly breakdown */}
            {byWeek.length > 1 && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Weekly Breakdown</div>
                <div className="mt-2 space-y-1.5">
                  {byWeek.slice(0, 12).map((w) => {
                    const wPresent = w.records.filter((r) => !!r.checkedInAt).length;
                    const wTotal = w.records.length;
                    const wPct = wTotal ? Math.round((wPresent / wTotal) * 100) : 0;
                    return (
                      <div key={w.week} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs font-semibold text-gray-600">
                          {new Date(w.week + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={["h-full rounded-full", wPct >= 80 ? "bg-emerald-400" : wPct >= 50 ? "bg-amber-400" : "bg-rose-400"].join(" ")}
                            style={{ width: `${wPct}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-gray-500">
                          {wPresent}/{wTotal} ({wPct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Records table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.slice(0, 60).map((r) => {
                    const present = !!r.checkedInAt;
                    const inTime = r.checkedInAt ? new Date(r.checkedInAt) : null;
                    const isLate = inTime && inTime.getHours() >= 9;
                    return (
                      <tr key={r.id} className={present ? "" : "bg-rose-50/40"}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{fmtDay(r.day)}</td>
                        <td className="px-4 py-3">
                          {present ? (
                            <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"].join(" ")}>
                              <span className={["h-1.5 w-1.5 rounded-full", isLate ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
                              {isLate ? "Late" : "Present"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Absent
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{fmtTime(r.checkedInAt)}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtTime(r.checkedOutAt)}</td>
                        <td className="px-4 py-3 text-gray-600">{duration(r.checkedInAt, r.checkedOutAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sorted.length > 60 && (
                <div className="border-t border-gray-200 bg-gray-50 p-2 text-center text-xs text-gray-500">
                  Showing 60 of {sorted.length} records
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VisualMetricCard({ title, value, helper, accent }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: hexToRgba(accent, 0.35), background: `linear-gradient(180deg, ${hexToRgba(accent, 0.08)} 0%, #ffffff 100%)` }}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-600">{helper}</div>
    </div>
  );
}
