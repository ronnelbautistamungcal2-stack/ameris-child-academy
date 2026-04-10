import AdminLayout from "@/components/admin/AdminLayout";
import ActiveGoalsPanel from "@/components/progression/ActiveGoalsPanel";
import { useProgressUpdates } from "@/hooks/useSocket";
import { AGE_GROUPS, ageGroupKeyFromBirthDate } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "COMPLETED"];

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

const STATUS_COLORS = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const STAGE_FILTERS = [
  { value: "active", label: "Active Goals", icon: IconActive },
  { value: "all", label: "All Goals", icon: IconAll },
  { value: "completed", label: "Completed", icon: IconCompleted },
  { value: "failed", label: "Failed", icon: IconFailed },
];

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function formatDate(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString();
}

export default function AdminProgress() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");

  const [lessons, setLessons] = useState([]);
  const [progressRows, setProgressRows] = useState([]);

  const [drafts, setDrafts] = useState({});
  const [savingLessonId, setSavingLessonId] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stage, setStage] = useState("all");
  const [ageGroup, setAgeGroup] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);

  const [overviewProgress, setOverviewProgress] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setChildren([]);
        setClasses([]);
        setLessons([]);
        setChildId("");
        setClassId("");
        setProgressRows([]);
        setQuery("");
        setCategory("");
        setStage("all");
        setAgeGroup("");
        setVisibleCount(100);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [kids, l, cls] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setLessons(Array.isArray(l) ? l : []);
        setClasses(Array.isArray(cls) ? cls : []);
      } catch (e) {
        setError(e.message || "Failed to load center data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    (async () => {
      if (!childId) {
        setProgressRows([]);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const p = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`);
        setProgressRows(Array.isArray(p) ? p : []);
      } catch (e) {
        setError(e.message || "Failed to load child progress");
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  const loadChildProgress = useCallback(async (targetChildId) => {
    if (!targetChildId) return;
    const progress = await apiJson(
      `/api/v1/progress?childId=${encodeURIComponent(targetChildId)}`,
    );
    setProgressRows(Array.isArray(progress) ? progress : []);
  }, []);

  const loadOverviewProgress = useCallback(async (targetCenterId) => {
    if (!targetCenterId) {
      setOverviewProgress([]);
      return;
    }
    const allProgress = await apiJson(
      `/api/v1/progress?centerId=${encodeURIComponent(targetCenterId)}`,
    );
    setOverviewProgress(Array.isArray(allProgress) ? allProgress : []);
  }, []);

  const filteredChildren = useMemo(() => {
    let result = children;
    if (classId) {
      result = result.filter((ch) => ch.classRoomId === classId);
    }
    if (ageGroup) {
      result = result.filter((ch) => ageGroupKeyFromBirthDate(ch.birthDate) === ageGroup);
    }
    return result;
  }, [children, classId, ageGroup]);

  const childOptions = useMemo(() => {
    return [...filteredChildren].sort((a, b) => byString(a.firstName, b.firstName));
  }, [filteredChildren]);

  useEffect(() => {
    if (classId && childId) {
      const stillValid = filteredChildren.some((ch) => ch.id === childId);
      if (!stillValid) setChildId("");
    }
  }, [classId, childId, filteredChildren]);

  const selectedChild = useMemo(() => {
    return children.find((ch) => ch.id === childId) || null;
  }, [children, childId]);

  const remediationMap = useMemo(() => {
    const map = new Map();
    for (const lesson of lessons) {
      const toLessons = (lesson?.remediationsFrom || [])
        .map((r) => r?.toLesson)
        .filter(Boolean);
      map.set(lesson.id, toLessons);
    }
    return map;
  }, [lessons]);

  const currentProgressByLessonId = useMemo(() => {
    const map = new Map();
    for (const pr of progressRows) {
      const existing = map.get(pr.lessonId);
      if (!existing) {
        map.set(pr.lessonId, pr);
        continue;
      }
      const a = Number(existing.goalIndex || 0);
      const b = Number(pr.goalIndex || 0);
      if (b > a) map.set(pr.lessonId, pr);
    }
    return map;
  }, [progressRows]);

  const lessonStatusFlags = useMemo(() => {
    const map = new Map();
    for (const pr of progressRows) {
      if (!map.has(pr.lessonId)) map.set(pr.lessonId, { hasCompleted: false, hasFailed: false });
      const flags = map.get(pr.lessonId);
      if (pr.status === "COMPLETED" || pr.status === "PASSED") flags.hasCompleted = true;
      if (pr.status === "FAILED") flags.hasFailed = true;
    }
    return map;
  }, [progressRows]);

  const lessonRows = useMemo(() => {
    const rows = lessons.map((l) => {
      const pr = currentProgressByLessonId.get(l.id) || null;
      const draft = drafts[l.id] || { status: "IN_PROGRESS", notes: "" };
      const recommended = remediationMap.get(l.id) || [];
      return { lesson: l, progress: pr, draft, recommended };
    });

    const sorted = rows.sort((a, b) => {
      const catA = a.lesson?.category?.name || "";
      const catB = b.lesson?.category?.name || "";
      const cmpCat = catA.localeCompare(catB);
      if (cmpCat !== 0) return cmpCat;
      return byString(a.lesson?.title, b.lesson?.title);
    });

    const q = String(query || "").trim().toLowerCase();
    return sorted.filter(({ lesson }) => {
      const flags = lessonStatusFlags.get(lesson.id);
      if (stage === "completed" && !flags?.hasCompleted) return false;
      if (stage === "failed" && !flags?.hasFailed) return false;
      if (category && (lesson?.category?.name || "") !== category) return false;
      if (!q) return true;
      const haystack = [lesson?.title, lesson?.description, lesson?.category?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [lessons, currentProgressByLessonId, drafts, remediationMap, lessonStatusFlags, query, category, stage]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const l of lessons) {
      const name = l?.category?.name;
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [lessons]);

  function setDraft(lessonId, next) {
    setDrafts((prev) => ({ ...prev, [lessonId]: { ...(prev[lessonId] || {}), ...next } }));
  }

  async function recordEntry(lessonId) {
    if (!childId) {
      setError("Select a child first.");
      return;
    }
    const draft = drafts[lessonId] || { status: "IN_PROGRESS", notes: "" };
    setSavingLessonId(lessonId);
    setError("");

    try {
      let progress = currentProgressByLessonId.get(lessonId) || null;
      if (!progress) {
        progress = await apiJson("/api/v1/progress", {
          method: "POST",
          body: JSON.stringify({ childId, lessonId, status: "NOT_STARTED", goalIndex: 1 }),
        });
      }
      await apiJson(`/api/v1/progress/${encodeURIComponent(progress.id)}/entries`, {
        method: "POST",
        body: JSON.stringify({ status: draft.status, notes: draft.notes || null }),
      });
      const refreshed = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`);
      setProgressRows(Array.isArray(refreshed) ? refreshed : []);
      setDraft(lessonId, { notes: "" });
    } catch (e) {
      setError(e.message || "Failed to record progress");
    } finally {
      setSavingLessonId("");
    }
  }

  async function refreshProgress() {
    if (!childId) return;
    try {
      await loadChildProgress(childId);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!centerId || childId) {
      setOverviewProgress([]);
      return;
    }
    (async () => {
      setOverviewLoading(true);
      try {
        await loadOverviewProgress(centerId);
      } catch {
        setOverviewProgress([]);
      } finally {
        setOverviewLoading(false);
      }
    })();
  }, [centerId, childId, loadOverviewProgress]);

  useProgressUpdates(
    centerId,
    useCallback(
      (updatedProgress) => {
        if (!updatedProgress || !centerId) return;

        if (childId) {
          if (updatedProgress.childId === childId) {
            loadChildProgress(childId).catch(() => null);
          }
          return;
        }

        loadOverviewProgress(centerId).catch(() => null);
      },
      [centerId, childId, loadChildProgress, loadOverviewProgress],
    ),
  );

  const classById = useMemo(() => {
    const map = new Map();
    for (const cls of classes) map.set(cls.id, cls);
    return map;
  }, [classes]);

  const overviewStats = useMemo(() => {
    if (!overviewProgress.length) return null;

    let filtered = overviewProgress;
    if (classId) filtered = filtered.filter((p) => p.child?.classRoomId === classId);
    if (ageGroup) filtered = filtered.filter((p) => ageGroupKeyFromBirthDate(p.child?.birthDate) === ageGroup);

    const statusCounts = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, PASSED: 0, FAILED: 0 };
    for (const p of filtered) {
      const s = p.status || "NOT_STARTED";
      if (s in statusCounts) statusCounts[s] += 1;
    }

    const byClass = new Map();
    for (const p of filtered) {
      const cId = p.child?.classRoomId || "unassigned";
      if (!byClass.has(cId)) byClass.set(cId, { IN_PROGRESS: 0, done: 0, FAILED: 0, NOT_STARTED: 0 });
      const counts = byClass.get(cId);
      const s = p.status || "NOT_STARTED";
      if (s === "COMPLETED" || s === "PASSED") counts.done += 1;
      else if (s === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      else if (s === "FAILED") counts.FAILED += 1;
      else counts.NOT_STARTED += 1;
    }

    const byAge = new Map();
    for (const p of filtered) {
      const ageKey = ageGroupKeyFromBirthDate(p.child?.birthDate) || "Unknown";
      if (!byAge.has(ageKey)) byAge.set(ageKey, { IN_PROGRESS: 0, done: 0, FAILED: 0, NOT_STARTED: 0 });
      const counts = byAge.get(ageKey);
      const s = p.status || "NOT_STARTED";
      if (s === "COMPLETED" || s === "PASSED") counts.done += 1;
      else if (s === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      else if (s === "FAILED") counts.FAILED += 1;
      else counts.NOT_STARTED += 1;
    }

    const byChild = new Map();
    for (const p of filtered) {
      if (!byChild.has(p.childId)) byChild.set(p.childId, { child: p.child, IN_PROGRESS: 0, done: 0, FAILED: 0, NOT_STARTED: 0, total: 0 });
      const counts = byChild.get(p.childId);
      counts.total += 1;
      const s = p.status || "NOT_STARTED";
      if (s === "COMPLETED" || s === "PASSED") counts.done += 1;
      else if (s === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      else if (s === "FAILED") counts.FAILED += 1;
      else counts.NOT_STARTED += 1;
    }

    const uniqueChildren = new Set(filtered.map((p) => p.childId));

    return {
      totalGoals: filtered.length,
      totalChildren: uniqueChildren.size,
      statusCounts,
      byClass: [...byClass.entries()].sort(([a], [b]) => {
        const nameA = classById.get(a)?.name || a;
        const nameB = classById.get(b)?.name || b;
        return nameA.localeCompare(nameB);
      }),
      byAge: [...byAge.entries()].sort(([a], [b]) => {
        const idxA = AGE_GROUPS.findIndex((g) => g.key === a);
        const idxB = AGE_GROUPS.findIndex((g) => g.key === b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      }),
      byChild: [...byChild.values()].sort((a, b) => byString(a.child?.firstName, b.child?.firstName)),
    };
  }, [overviewProgress, classId, ageGroup, classById]);

  const childName = selectedChild
    ? `${selectedChild.firstName} ${selectedChild.lastName || ""}`.trim()
    : "";

  return (
    <AdminLayout title="Progression Tracking">
      <div className="space-y-5">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-violet-100/40 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-indigo-100/40 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-200">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Progression Tracking</h2>
                <p className="text-sm text-gray-500">Track goals across classrooms, age groups, and individual children</p>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Filters */}
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <FilterSelect label="Center" value={centerId} onChange={setCenterId} disabled={loading} placeholder="Select a center..." icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              }>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FilterSelect>

              <FilterSelect label="Class / Group" value={classId} onChange={setClassId} disabled={!centerId || loading} placeholder="All classes" icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              }>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </FilterSelect>

              <FilterSelect label="Age Group" value={ageGroup} onChange={(v) => { setAgeGroup(v); setChildId(""); }} disabled={!centerId || loading} placeholder="All ages" icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              }>
                {AGE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </FilterSelect>

              <FilterSelect label="Child" value={childId} onChange={setChildId} disabled={!centerId || loading} placeholder={centerId && !childId ? "Overview (all)" : "Select child..."} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              }>
                {childOptions.map((ch) => <option key={ch.id} value={ch.id}>{ch.firstName} {ch.lastName || ""}</option>)}
              </FilterSelect>

              {/* Stage pills instead of select */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Stage</div>
                <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1">
                  {STAGE_FILTERS.map((s) => {
                    const Icon = s.icon;
                    const active = stage === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-bold transition-all ${
                          active
                            ? "bg-white text-violet-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                        onClick={() => { setStage(s.value); setVisibleCount(100); }}
                        title={s.label}
                      >
                        <Icon />
                        <span className="hidden xl:inline">{s.label.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overview: shown when no child is selected */}
        {stage !== "active" && !childId && centerId && (
          <ProgressOverview
            stats={overviewStats}
            loading={overviewLoading}
            classById={classById}
            onSelectChild={(id) => setChildId(id)}
          />
        )}

        {/* Active Goals View */}
        {stage === "active" && childId && (
          <ActiveGoalsPanel
            childId={childId}
            childName={childName}
            progressRows={progressRows}
            lessons={lessons}
            remediationMap={remediationMap}
            onRefresh={refreshProgress}
          />
        )}
        {stage === "active" && !childId && centerId && (
          <EmptyState
            icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            title="Select a child to view active goals"
            description="Choose a child from the filter above to see their in-progress, not started, and failed goals"
          />
        )}

        {/* No center selected */}
        {!centerId && !loading && (
          <EmptyState
            icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            title="Select a center to get started"
            description="Choose a center from the filter above to view progression data"
          />
        )}

        {/* All Goals / Completed / Failed Table View (child selected) */}
        {stage !== "active" && childId && (
          <LessonTableView
            stage={stage}
            loading={loading}
            lessonRows={lessonRows}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            categories={categories}
            lessons={lessons}
            drafts={drafts}
            setDraft={setDraft}
            savingLessonId={savingLessonId}
            recordEntry={recordEntry}
          />
        )}
      </div>
    </AdminLayout>
  );
}

/* ── Lesson Table View ─────────────────────────────── */

function LessonTableView({ stage, loading, lessonRows, visibleCount, setVisibleCount, query, setQuery, category, setCategory, categories, lessons, drafts, setDraft, savingLessonId, recordEntry }) {
  const stageLabel = stage === "all" ? "All Lessons" : stage === "completed" ? "Completed Goals" : "Failed Goals";
  const stageColor = stage === "completed" ? "emerald" : stage === "failed" ? "red" : "violet";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-${stageColor}-100 text-${stageColor}-600`}>
            {stage === "completed" ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : stage === "failed" ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            )}
          </span>
          {stageLabel}
          {!loading && (
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{lessonRows.length}</span>
          )}
        </h3>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading...
          </span>
        )}
      </div>

      <div className="p-5">
        {lessonRows.length === 0 && !loading ? (
          <EmptyState
            icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            title="No lessons found"
            description={stage !== "all" ? "No lessons match this filter. Try changing the stage filter." : "No lessons available for this center."}
          />
        ) : (
          <div className="space-y-4">
            {/* Search & Category filter */}
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-2.5 text-sm transition focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
                  placeholder="Search by lesson title, category..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setVisibleCount(100); }}
                />
              </div>
              <div className="relative md:w-56">
                <select
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm transition focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setVisibleCount(100); }}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Showing {Math.min(visibleCount, lessonRows.length)} of {lessonRows.length} lessons</span>
            </div>

            {/* Lesson Cards */}
            <div className="space-y-3">
              {lessonRows.slice(0, visibleCount).map(({ lesson, progress, draft, recommended }) => {
                const isFailed = (progress?.status || "") === "FAILED";
                const lastUpdate = progress?.updatedAt || progress?.createdAt || null;
                const goals = Array.isArray(lesson?.goals) ? lesson.goals : [];
                const currentGoal = progress ? goals.find((g) => Number(g.goalIndex || 0) === Number(progress.goalIndex || 0)) : null;
                const totalGoals = goals.length;

                return (
                  <div key={lesson.id} className={`rounded-2xl border p-4 transition hover:shadow-sm ${isFailed ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      {/* Lesson Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${isFailed ? "bg-red-500" : progress ? "bg-violet-500" : "bg-gray-400"}`}>
                            {progress ? `G${progress.goalIndex}` : "--"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">{lesson.title}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {lesson?.category?.name && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                  {lesson.category.name}
                                </span>
                              )}
                              {progress && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[progress.status] || STATUS_COLORS.NOT_STARTED}`}>
                                  {STATUS_LABEL[progress.status] || progress.status}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">{formatDate(lastUpdate)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Goal step progress bar */}
                        {totalGoals > 0 && progress && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex flex-1 gap-0.5">
                              {Array.from({ length: totalGoals }, (_, i) => {
                                const stepIndex = i + 1;
                                const isComplete = stepIndex < progress.goalIndex;
                                const isCurrent = stepIndex === progress.goalIndex;
                                return (
                                  <div
                                    key={stepIndex}
                                    className={`h-1.5 flex-1 rounded-full ${
                                      isComplete ? "bg-emerald-400" : isCurrent ? (isFailed ? "bg-red-400" : "bg-amber-400") : "bg-gray-200"
                                    }`}
                                    title={`Step ${stepIndex}${isComplete ? " (done)" : isCurrent ? " (current)" : ""}`}
                                  />
                                );
                              })}
                            </div>
                            <span className="shrink-0 text-[10px] font-bold text-gray-500">
                              {progress.goalIndex}/{totalGoals}
                            </span>
                          </div>
                        )}

                        {/* Current goal info */}
                        {currentGoal?.title && (
                          <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <span className="font-semibold text-gray-700">Current:</span> {currentGoal.title}
                          </div>
                        )}

                        {/* Failed remediation */}
                        {isFailed && recommended.length > 0 && (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              Recommended corrective lessons
                            </div>
                            <ul className="mt-1.5 space-y-1">
                              {recommended.slice(0, 5).map((r) => (
                                <li key={r.id} className="flex items-center gap-2 text-xs text-amber-800">
                                  <svg className="h-3 w-3 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                  {r.title}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Record Entry */}
                      <div className="flex shrink-0 flex-col gap-2 lg:w-64">
                        <div className="relative">
                          <select
                            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 pr-8 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                            value={draft.status || "IN_PROGRESS"}
                            onChange={(e) => setDraft(lesson.id, { status: e.target.value })}
                            disabled={savingLessonId === lesson.id}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                          <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        <input
                          className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                          placeholder="Notes (optional)..."
                          value={draft.notes || ""}
                          onChange={(e) => setDraft(lesson.id, { notes: e.target.value })}
                          disabled={savingLessonId === lesson.id}
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60"
                          onClick={() => recordEntry(lesson.id)}
                          disabled={savingLessonId === lesson.id}
                        >
                          {savingLessonId === lesson.id ? (
                            <>
                              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Record Entry
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {lessonRows.length > visibleCount && (
              <div className="text-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                  onClick={() => setVisibleCount((n) => n + 100)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Load 100 more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Progress Overview Panel ─────────────────────────── */

function ProgressOverview({ stats, loading, classById, onSelectChild }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-sm font-medium text-gray-500">Loading progress overview...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        title="No progress data found"
        description="Select a child to start tracking goals, or progress hasn't been recorded yet"
      />
    );
  }

  const { statusCounts, byClass, byAge, byChild, totalGoals, totalChildren } = stats;

  // Compute completion rate
  const completedCount = statusCounts.COMPLETED + statusCounts.PASSED;
  const completionRate = totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <OverviewCard label="Total Goals" count={totalGoals} color="violet" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        } sub={`${totalChildren} children`} />
        <OverviewCard label="In Progress" count={statusCounts.IN_PROGRESS} color="amber" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        } />
        <OverviewCard label="Completed" count={completedCount} color="emerald" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        } />
        <OverviewCard label="Failed" count={statusCounts.FAILED} color="red" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        } />
        <OverviewCard label="Not Started" count={statusCounts.NOT_STARTED} color="gray" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        } />
        <OverviewCard label="Completion" count={`${completionRate}%`} color="sky" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        } />
      </div>

      {/* Completion bar */}
      {totalGoals > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
            <span>Overall Progress</span>
            <span>{completedCount} / {totalGoals} goals</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
            {completedCount > 0 && (
              <div className="bg-emerald-400 transition-all" style={{ width: `${(completedCount / totalGoals) * 100}%` }} title={`Completed: ${completedCount}`} />
            )}
            {statusCounts.IN_PROGRESS > 0 && (
              <div className="bg-amber-400 transition-all" style={{ width: `${(statusCounts.IN_PROGRESS / totalGoals) * 100}%` }} title={`In Progress: ${statusCounts.IN_PROGRESS}`} />
            )}
            {statusCounts.FAILED > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${(statusCounts.FAILED / totalGoals) * 100}%` }} title={`Failed: ${statusCounts.FAILED}`} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Completed ({completedCount})</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> In Progress ({statusCounts.IN_PROGRESS})</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Failed ({statusCounts.FAILED})</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-200" /> Not Started ({statusCounts.NOT_STARTED})</span>
          </div>
        </div>
      )}

      {/* By Classroom */}
      {byClass.length > 0 && (
        <OverviewTable
          title="Progress by Classroom"
          icon={<svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>}
          rows={byClass.map(([classRoomId, counts]) => ({
            label: classById.get(classRoomId)?.name || (classRoomId === "unassigned" ? "Unassigned" : classRoomId),
            counts,
            total: counts.IN_PROGRESS + counts.done + counts.FAILED + counts.NOT_STARTED,
          }))}
        />
      )}

      {/* By Age Group */}
      {byAge.length > 0 && (
        <OverviewTable
          title="Progress by Age Group"
          icon={<svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          rows={byAge.map(([ageKey, counts]) => {
            const group = AGE_GROUPS.find((g) => g.key === ageKey);
            return {
              label: group?.label || ageKey,
              counts,
              total: counts.IN_PROGRESS + counts.done + counts.FAILED + counts.NOT_STARTED,
            };
          })}
        />
      )}

      {/* Per-Child Summary */}
      {byChild.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-sm font-extrabold text-gray-900">Progress by Child</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{byChild.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Child</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Progress</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">In Progress</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Completed</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Failed</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Not Started</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byChild.map((row) => {
                  const ch = row.child;
                  if (!ch) return null;
                  const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim();
                  const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
                  return (
                    <tr key={ch.id} className="transition hover:bg-gray-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                            {(ch.firstName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{name}</div>
                            <div className="text-[10px] text-gray-500">{row.total} total goal{row.total !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-gray-600">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusCount value={row.IN_PROGRESS} color="amber" />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusCount value={row.done} color="emerald" />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusCount value={row.FAILED} color="red" />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusCount value={row.NOT_STARTED} color="gray" />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectChild(ch.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ──────────────────────────────── */

function OverviewTable({ title, icon, rows }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        {icon}
        <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Name</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">In Progress</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Completed</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Failed</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Not Started</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const pct = row.total > 0 ? Math.round((row.counts.done / row.total) * 100) : 0;
              return (
                <tr key={i} className="transition hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="font-semibold text-gray-900">{row.label}</div>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center"><StatusCount value={row.counts.IN_PROGRESS} color="amber" /></td>
                  <td className="px-4 py-3.5 text-center"><StatusCount value={row.counts.done} color="emerald" /></td>
                  <td className="px-4 py-3.5 text-center"><StatusCount value={row.counts.FAILED} color="red" /></td>
                  <td className="px-4 py-3.5 text-center"><StatusCount value={row.counts.NOT_STARTED} color="gray" /></td>
                  <td className="px-4 py-3.5 text-center"><span className="text-xs font-bold text-gray-700">{row.total}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewCard({ label, count, color, icon, sub }) {
  const colors = {
    violet: "from-violet-50 to-violet-100/50 text-violet-600 border-violet-200/60",
    sky: "from-sky-50 to-sky-100/50 text-sky-600 border-sky-200/60",
    amber: "from-amber-50 to-amber-100/50 text-amber-600 border-amber-200/60",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200/60",
    red: "from-red-50 to-red-100/50 text-red-600 border-red-200/60",
    gray: "from-gray-50 to-gray-100/50 text-gray-600 border-gray-200/60",
  };
  const c = colors[color] || colors.gray;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
          <div className="mt-1 text-2xl font-extrabold">{count}</div>
          {sub && <div className="mt-0.5 text-[10px] opacity-50">{sub}</div>}
        </div>
        <div className="opacity-30">{icon}</div>
      </div>
    </div>
  );
}

function StatusCount({ value, color }) {
  if (!value || value === 0) return <span className="text-xs text-gray-300">0</span>;
  const colors = {
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${colors[color] || colors.gray}`}>
      {value}
    </span>
  );
}

function FilterSelect({ label, value, onChange, disabled, placeholder, icon, children }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</div>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        <select
          className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-gray-800 shadow-sm transition hover:border-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
    </div>
  );
}

/* ── Stage Filter Icons ──────────────────────────────── */

function IconActive() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}
function IconAll() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
}
function IconCompleted() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
function IconFailed() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}
