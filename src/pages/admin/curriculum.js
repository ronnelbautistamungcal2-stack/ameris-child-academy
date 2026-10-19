import AdminLayout from "@/components/admin/AdminLayout";
import CategoryListsTab from "@/components/curriculum/CategoryListsTab";
import CurriculumTabs from "@/components/curriculum/CurriculumTabs";
import StepsOfProgressionBank from "@/components/curriculum/StepsOfProgressionBank";
import { FormField } from "@/components/curriculum/stepParts";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { lessonOptionLabel } from "@/lib/lessonScheduling";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Categories and Steps of Progression are tabs of the Curriculum bar
// (CurriculumTabs); Remediations sits beside Steps of Progression.
const TABS = [
  { key: "lessons", label: "Steps of Progression", icon: TabIconLessons },
  { key: "remediations", label: "Remediations", icon: TabIconRemediations },
];
const TAB_KEYS = ["categories", "lessons", "remediations"];

export default function CurriculumManager() {
  const router = useRouter();
  const tab = TAB_KEYS.includes(router.query.tab) ? router.query.tab : "categories";
  const setTab = (key) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = (Array.isArray(c) ? c : []).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setCenters(arr);
        let remembered = "";
        try {
          remembered = JSON.parse(window.localStorage.getItem("aca:curriculumClassroom") || "{}").centerId || "";
        } catch {
          // Storage can be blocked; fall back to the demo center.
        }
        const pick = arr.find((x) => x.id === remembered) || arr.find((x) => x.name === "Demo Center") || arr[0];
        if (pick) setCenterId(pick.id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const heading = tab === "categories" ? "Categories" : tab === "remediations" ? "Remediations" : "Steps of Progression Bank";

  return (
    <AdminLayout title="Curriculum">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-black text-[#0b2a5b] dark:text-blue-100">{heading}</h1>
          {centers.length > 1 && (
            <label className="text-xs font-semibold text-[#0b2a5b] dark:text-blue-100">
              Center
              <select
                className="mt-1 block w-52 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <CurriculumTabs active={tab === "categories" ? "categories" : "steps"} />

        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {tab !== "categories" && (
          <div className="flex w-fit gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-700 dark:bg-gray-800">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                    active ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-900 dark:text-indigo-300" : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setTab(t.key)}
                >
                  <Icon active={active} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {centerId ? (
          <>
            {tab === "categories" && <CategoryListsTab centerId={centerId} />}
            {tab === "lessons" && <StepsOfProgressionBank centerId={centerId} />}
            {tab === "remediations" && <RemediationsTab centerId={centerId} />}
          </>
        ) : (
          !loading && <p className="text-sm text-gray-500">There are no centers yet.</p>
        )}
      </div>
    </AdminLayout>
  );
}

/* ── Tab Icons ───────────────────────────────────────── */

function TabIconLessons({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-indigo-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function TabIconRemediations({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-indigo-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}



/* ── Remediations Tab ────────────────────────────────── */

function RemediationsTab({ centerId }) {
  const [remediations, setRemediations] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([
        apiJson(`/api/v1/remediations?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setRemediations(Array.isArray(r) ? r : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [centerId]);

  async function addLink() {
    if (!fromId || !toId) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(fromId)}/remediations`, {
        method: "POST",
        body: JSON.stringify({ toLessonId: toId, reason: reason || null }),
      });
      setAdding(false);
      setFromId("");
      setToId("");
      setReason("");
      await load();
    } catch (e) {
      setError(e.message || "Failed to add remediation");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(fromLessonId, id) {
    if (!confirm("Remove this remediation link?")) return;
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(fromLessonId)}/remediations`, {
        method: "DELETE",
        body: JSON.stringify({ remediationId: id }),
      });
      await load();
    } catch (e) {
      setError(e.message || "Failed to remove");
    }
  }

  async function handleAutoGeneratePreview() {
    setAutoGenerating(true);
    setError("");
    setPreview(null);
    setCommitResult(null);
    try {
      const result = await apiJson("/api/v1/remediations/auto-generate", {
        method: "POST",
        body: JSON.stringify({ centerId, dryRun: true }),
      });
      setPreview(result);
    } catch (e) {
      setError(e.message || "Failed to preview auto-generation");
    } finally {
      setAutoGenerating(false);
    }
  }

  async function handleAutoGenerateCommit() {
    setCommitting(true);
    setError("");
    try {
      const result = await apiJson("/api/v1/remediations/auto-generate", {
        method: "POST",
        body: JSON.stringify({ centerId, dryRun: false }),
      });
      setCommitResult(result);
      setPreview(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to auto-generate remediations");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Remediation Links" value={loading ? "..." : remediations.length} color="orange" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        } />
        <StatCard label="Lessons" value={loading ? "..." : lessons.length} color="indigo" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        } />
        <StatCard label="Coverage" value={loading ? "..." : lessons.length > 0 ? `${Math.round((new Set(remediations.map(r => r.fromLessonId)).size / lessons.length) * 100)}%` : "0%"} color="emerald" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        } />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Corrective Learning Paths
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-60"
              onClick={handleAutoGeneratePreview}
              disabled={autoGenerating}
            >
              <svg className={`h-3.5 w-3.5 ${autoGenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {autoGenerating ? "Analyzing..." : "Auto-Generate"}
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow active:scale-[0.98]" onClick={() => setAdding(true)}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Link
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Auto-generate commit result */}
          {commitResult && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-emerald-900">Auto-Generation Complete</h4>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                  {commitResult.commitResult.created} created
                </span>
                {commitResult.commitResult.updated > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm">
                    {commitResult.commitResult.updated} updated
                  </span>
                )}
                {commitResult.commitResult.errors?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm">
                    {commitResult.commitResult.errors.length} errors
                  </span>
                )}
              </div>
              <button type="button" className="mt-3 text-xs font-semibold text-gray-500 transition hover:text-gray-700" onClick={() => setCommitResult(null)}>
                Dismiss
              </button>
            </div>
          )}

          {/* Auto-generate preview */}
          {preview && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-sky-50/30 p-5 space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </h4>

              <div className="flex flex-wrap gap-2">
                <MiniStatBadge label="Lessons analyzed" value={preview.stats.totalLessons} color="gray" />
                <MiniStatBadge label="Groups" value={preview.stats.bucketsFound} color="gray" />
                <MiniStatBadge label="New links" value={preview.stats.proposalsGenerated} color="emerald" />
                {preview.stats.skippedExisting > 0 && (
                  <MiniStatBadge label="Already exist" value={preview.stats.skippedExisting} color="amber" />
                )}
                {preview.stats.goalsWithoutRef > 0 && (
                  <MiniStatBadge label="No reference" value={preview.stats.goalsWithoutRef} color="gray" />
                )}
              </div>

              {preview.proposals.length > 0 ? (
                <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
                  {preview.proposals.slice(0, 50).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2.5 text-xs transition hover:bg-gray-100">
                      <span className="max-w-[180px] truncate rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                        {p.fromLessonTitle}
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="max-w-[180px] truncate rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        {p.toLessonTitle}
                      </span>
                      <span className="ml-auto whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{p.age} / {p.subjectCode}</span>
                    </div>
                  ))}
                  {preview.proposals.length > 50 && (
                    <div className="py-2 text-center text-xs text-gray-500">
                      ... and {preview.proposals.length - 50} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-white p-4 text-center text-sm text-gray-500">
                  All sequential links already exist. Nothing new to generate.
                </div>
              )}

              <div className="flex gap-2">
                {preview.proposals.length > 0 && (
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                    onClick={handleAutoGenerateCommit}
                    disabled={committing}
                  >
                    {committing ? "Creating..." : `Create ${preview.proposals.length} Links`}
                  </button>
                )}
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add link form */}
          {adding && (
            <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-sky-50/30 p-5 space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500 text-xs text-white">+</span>
                New Remediation Link
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="When this lesson fails">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                    <option value="">Select lesson...</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{lessonOptionLabel(l)}</option>)}
                  </select>
                </FormField>
                <FormField label="Recommend this corrective lesson">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={toId} onChange={(e) => setToId(e.target.value)}>
                    <option value="">Select lesson...</option>
                    {lessons.filter((l) => l.id !== fromId).map((l) => <option key={l.id} value={l.id}>{lessonOptionLabel(l)}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Reason (optional)">
                <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this remediation is recommended..." />
              </FormField>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60" onClick={addLink} disabled={saving || !fromId || !toId}>
                  {saving ? "Saving..." : "Create Link"}
                </button>
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Remediation links list */}
          {loading ? (
            <Skeleton count={4} />
          ) : remediations.length === 0 ? (
            <EmptyState
              icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
              title="No remediation links yet"
              description="Create links between lessons to define corrective learning paths, or auto-generate them from your curriculum"
              action={
                <div className="flex gap-2">
                  <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100" onClick={handleAutoGeneratePreview} disabled={autoGenerating}>Auto-Generate</button>
                  <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700" onClick={() => setAdding(true)}>Add Manually</button>
                </div>
              }
            />
          ) : (
            <div className="space-y-2">
              {remediations.map((r) => (
                <div key={r.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                      <svg className="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r.fromLesson?.title || "?"}
                    </span>
                    <svg className="h-5 w-5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r.toLesson?.title || "?"}
                    </span>
                    {r.reason && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{r.reason}</span>
                    )}
                  </div>
                  <button type="button" className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 opacity-0 transition hover:bg-red-50 group-hover:opacity-100" onClick={() => removeLink(r.fromLessonId, r.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared Components ──────────────────────────────── */

function StatCard({ label, value, color, icon }) {
  const colors = {
    indigo: "from-indigo-50 to-indigo-100/50 text-indigo-600 border-indigo-200/60",
    sky: "from-sky-50 to-sky-100/50 text-sky-600 border-sky-200/60",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200/60",
    amber: "from-amber-50 to-amber-100/50 text-amber-600 border-amber-200/60",
    orange: "from-orange-50 to-orange-100/50 text-orange-600 border-orange-200/60",
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-60">{label}</div>
          <div className="mt-1 text-2xl font-extrabold">{value}</div>
        </div>
        <div className="opacity-40">{icon}</div>
      </div>
    </div>
  );
}

function MiniStatBadge({ label, value, color }) {
  const colors = {
    gray: "border-gray-200 bg-white text-gray-700",
    emerald: "border-emerald-200 bg-white text-emerald-700",
    amber: "border-amber-200 bg-white text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm ${colors[color] || colors.gray}`}>
      <span className="font-bold">{value}</span> {label}
    </span>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
