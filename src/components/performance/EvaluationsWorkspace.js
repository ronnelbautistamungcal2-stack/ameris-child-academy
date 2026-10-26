import { NAVY } from "@/components/reports/reportUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useState } from "react";

// Coach › Evaluations (client mockups 27-Evaluations): for a date range, each
// staff member's average evaluation grade and average score per category
// (out of 5), View for their evaluations, and the Create Evaluation pop-up
// (category sliders 1–5 with "Not evaluated", saved as a draft or submitted
// to the staff member).

const EVAL_TYPES = ["Annual Review", "Mid-Year Review", "90-Day Review", "Probationary Review", "Observation", "Performance Improvement", "Other"];
const STAFF_ROLES = "TEACHER,OTHER_STAFF,KITCHEN_STAFF,HR_STAFF,STUDENT_SUPPORT,COACH";
const control = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

function dayKey(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** The overall score %: the average of the scored categories out of 5. */
export function evaluationScore(categories) {
  const values = Object.values(categories || {}).filter((v) => typeof v === "number");
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 20) : null;
}

const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const counted = (e) => e.status !== "DRAFT";

export default function EvaluationsWorkspace({ Layout, layoutProps = {} }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from: dayKey(from), to: dayKey(to) };
  });
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [evaluations, setEvaluations] = useState(null);
  const [error, setError] = useState("");
  const [viewId, setViewId] = useState("");
  const [editing, setEditing] = useState(null); // {} for new, evaluation to edit, { teacherId } prefilled

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  useEffect(() => {
    if (!centerId) return;
    Promise.all([
      apiJson(`/api/v1/users?employedOnly=true&centerId=${encodeURIComponent(centerId)}&roles=${STAFF_ROLES}`),
      apiJson(`/api/v1/evaluation-category-config?centerId=${encodeURIComponent(centerId)}`).catch(() => null),
    ])
      .then(([users, config]) => {
        setStaff(Array.isArray(users) ? users : []);
        setCategories(Array.isArray(config?.categories) ? config.categories : []);
      })
      .catch((e) => setError(e.message || "Failed to load staff"));
  }, [centerId]);

  const load = useCallback(async () => {
    if (!centerId || range.from > range.to) return;
    setError("");
    try {
      const rows = await apiJson(`/api/v1/evaluations?${new URLSearchParams({ centerId, from: range.from, to: range.to })}`);
      setEvaluations(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.message || "Failed to load evaluations");
      setEvaluations([]);
    }
  }, [centerId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => {
    const names = [...categories];
    for (const e of evaluations || []) for (const key of Object.keys(e.categories || {})) if (!names.includes(key)) names.push(key);
    return names;
  }, [categories, evaluations]);

  const rows = useMemo(() => {
    const list = staff.map((user) => {
      const mine = (evaluations || []).filter((e) => e.teacherId === user.id);
      const scored = mine.filter(counted);
      return {
        user,
        evaluations: mine,
        grade: avg(scored.map((e) => e.overallScore).filter((v) => typeof v === "number")),
        drafts: mine.filter((e) => e.status === "DRAFT").length,
        perCategory: Object.fromEntries(columns.map((c) => [c, avg(scored.map((e) => e.categories?.[c]).filter((v) => typeof v === "number"))])),
      };
    });
    return list.sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1) || (a.user.name || "").localeCompare(b.user.name || ""));
  }, [staff, evaluations, columns]);

  const viewing = rows.find((r) => r.user.id === viewId);

  return (
    <Layout title="Evaluations" {...layoutProps}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={`text-3xl font-black ${NAVY}`}>Evaluations</h1>
          <button type="button" onClick={() => setEditing({})} disabled={!centerId} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            + Create Evaluation
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-3">
            {centers.length > 1 ? (
              <label className={`text-sm font-semibold ${NAVY}`}>
                Center
                <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-48`}>
                  <option value="">Select a center...</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : null}
            <div className={`text-sm font-semibold ${NAVY}`}>
              Date Range
              <div className="mt-1 flex items-center gap-2">
                <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} className={`${control} mt-0 w-44`} aria-label="Start date" />
                <span className="text-gray-500">to</span>
                <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} className={`${control} mt-0 w-44`} aria-label="End date" />
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500">Showing evaluations for the selected date range.</p>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {!centerId ? (
            <p className="p-6 text-sm text-gray-500">Choose a center.</p>
          ) : !evaluations ? (
            <div className="p-6"><Skeleton count={6} /></div>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-blue-50 text-xs font-bold uppercase text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-3 py-3 text-center">Avg Evaluation Grade</th>
                  {columns.map((c) => <th key={c} className="px-3 py-3 text-center">{c}</th>)}
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-blue-800 dark:text-blue-300">{r.user.name || r.user.email}</div>
                      <div className="text-xs text-gray-500">{r.user.staffDepartment || roleLabel(r.user.role)}</div>
                    </td>
                    <td className={`px-3 py-2.5 text-center font-black ${NAVY}`}>
                      {r.grade != null ? `${Math.round(r.grade)}%` : r.drafts ? <span className="text-xs font-semibold text-amber-700">Draft only</span> : "—"}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className={`px-3 py-2.5 text-center font-semibold ${NAVY}`}>
                        {r.perCategory[c] != null ? <>{Math.round(r.perCategory[c] * 10) / 10}<span className="text-gray-400">/5</span></> : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <button type="button" onClick={() => setViewId(r.user.id)} className="rounded-lg border border-blue-600 px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {evaluations ? <p className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500 dark:border-gray-800">Showing {rows.length} employees</p> : null}
        </div>
      </div>

      {viewing ? (
        <EmployeeEvaluations
          row={viewing}
          onClose={() => setViewId("")}
          onEdit={(evaluation) => setEditing(evaluation)}
          onNew={() => setEditing({ teacherId: viewing.user.id })}
        />
      ) : null}
      {editing ? (
        <EvaluationDialog
          evaluation={editing}
          staff={staff}
          categories={categories.length ? categories : columns}
          centerId={centerId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </Layout>
  );
}

function EmployeeEvaluations({ row, onClose, onEdit, onNew }) {
  const day = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-10" role="dialog" aria-modal="true" aria-label="Employee evaluations">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className={`text-xl font-black ${NAVY}`}>{row.user.name || row.user.email}</h2>
            <p className="text-sm text-gray-500">{row.evaluations.length} evaluation{row.evaluations.length === 1 ? "" : "s"} in these dates</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-6 py-4">
          {!row.evaluations.length ? <p className="text-sm text-gray-500">No evaluations in these dates.</p> : null}
          {row.evaluations.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className={`font-black ${NAVY}`}>{ev.evaluationType || "Evaluation"} · {ev.period}</div>
                  <div className="text-xs text-gray-500">By {ev.evaluator?.name || "—"} · {day(ev.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ev.status === "DRAFT" ? "bg-gray-200 text-gray-700" : ev.status === "SUBMITTED" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {ev.status === "DRAFT" ? "Draft" : ev.status === "SUBMITTED" ? "Submitted" : "Acknowledged"}
                  </span>
                  <span className={`text-lg font-black ${NAVY}`}>{ev.overallScore != null ? `${ev.overallScore}%` : "—"}</span>
                  {ev.status !== "ACKNOWLEDGED" ? (
                    <button type="button" onClick={() => onEdit(ev)} className="rounded-lg border border-blue-600 px-3 py-1 text-xs font-semibold text-blue-700">Edit</button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(ev.categories || {}).map(([c, v]) => (
                  <span key={c} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900 dark:bg-gray-800 dark:text-blue-100">
                    {c}: {v == null ? "Not evaluated" : `${v}/5`}
                  </span>
                ))}
              </div>
              {[["Strengths", ev.strengths], ["Areas for Improvement", ev.areasForImprovement], ["Goals", ev.goals], ["Notes", ev.notes]]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <p key={label} className="mt-2 text-sm text-gray-700 dark:text-gray-300"><strong>{label}:</strong> {value}</p>
                ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" onClick={onNew} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ New Evaluation</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Close</button>
        </div>
      </div>
    </div>
  );
}

function EvaluationDialog({ evaluation, staff, categories, centerId, onClose, onSaved }) {
  const isEdit = Boolean(evaluation.id);
  const toKey = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const [form, setForm] = useState(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    return {
      teacherId: evaluation.teacherId || "",
      evaluationType: evaluation.evaluationType || "",
      periodStart: toKey(evaluation.periodStart) || dayKey(start),
      periodEnd: toKey(evaluation.periodEnd) || dayKey(today),
      categories: evaluation.categories && Object.keys(evaluation.categories).length ? { ...evaluation.categories } : Object.fromEntries(categories.map((c) => [c, 3])),
      strengths: evaluation.strengths || "",
      areasForImprovement: evaluation.areasForImprovement || "",
      goals: evaluation.goals || "",
      notes: evaluation.notes || "",
    };
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const score = evaluationScore(form.categories);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(status) {
    if (!form.teacherId || !form.evaluationType || !form.periodStart || !form.periodEnd) {
      setError("Choose the employee, evaluation type and dates.");
      return;
    }
    if (form.periodEnd < form.periodStart) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      centerId,
      teacherId: form.teacherId,
      evaluationType: form.evaluationType,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      categories: form.categories,
      overallScore: score,
      strengths: form.strengths || null,
      areasForImprovement: form.areasForImprovement || null,
      goals: form.goals || null,
      notes: form.notes || null,
      status,
    };
    try {
      if (isEdit) {
        const { centerId: _c, teacherId: _t, ...patch } = body;
        await apiJson(`/api/v1/evaluations/${evaluation.id}`, { method: "PUT", body: JSON.stringify(patch) });
      } else {
        await apiJson("/api/v1/evaluations", { method: "POST", body: JSON.stringify(body) });
      }
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the evaluation");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8" role="dialog" aria-modal="true" aria-label="Create Evaluation">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className={`text-2xl font-black ${NAVY}`}>{isEdit ? "Edit Evaluation" : "Create Evaluation"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div className="space-y-4 px-6 py-4">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase text-gray-600">
              Employee *
              <select value={form.teacherId} onChange={(e) => set({ teacherId: e.target.value })} disabled={isEdit} className={control} aria-label="Employee">
                <option value="">Select employee...</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-gray-600">
              Evaluation Type *
              <select value={form.evaluationType} onChange={(e) => set({ evaluationType: e.target.value })} className={control} aria-label="Evaluation type">
                <option value="">Select type...</option>
                {[...new Set([...(form.evaluationType ? [form.evaluationType] : []), ...EVAL_TYPES])].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-gray-600">
              Start Date *
              <input type="date" value={form.periodStart} onChange={(e) => set({ periodStart: e.target.value })} className={control} />
            </label>
            <label className="text-xs font-bold uppercase text-gray-600">
              End Date *
              <input type="date" value={form.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} className={control} />
            </label>
          </div>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-gray-800 dark:text-blue-100">
            The selected period will be saved as <strong>{form.periodStart} to {form.periodEnd}</strong>.
          </p>
          <div>
            <div className="text-xs font-bold uppercase text-gray-600">Category Scores (1–5) — check &quot;Not evaluated&quot; to skip a category without affecting the score</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {Object.keys(form.categories).map((c) => {
                const value = form.categories[c];
                return (
                  <div key={c} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${NAVY}`}>{c}</span>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input type="checkbox" checked={value == null} onChange={(e) => set({ categories: { ...form.categories, [c]: e.target.checked ? null : 3 } })} />
                        Not evaluated
                      </label>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={value ?? 3}
                      disabled={value == null}
                      onChange={(e) => set({ categories: { ...form.categories, [c]: Number(e.target.value) } })}
                      aria-label={`${c} score`}
                      className="mt-2 w-full accent-blue-600"
                    />
                    <div className={`text-center text-sm font-black ${NAVY}`}>{value == null ? "—" : `${value}/5`}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["strengths", "Strengths", "Enter strengths..."], ["areasForImprovement", "Areas for Improvement", "Enter areas for improvement..."], ["goals", "Goals", "Enter goals..."], ["notes", "Notes", "Enter additional notes..."]].map(([key, label, placeholder]) => (
              <label key={key} className="text-xs font-bold uppercase text-gray-600">
                {label}
                <textarea rows={3} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder={placeholder} className={`${control} font-normal normal-case`} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className={`text-lg font-black ${NAVY}`}>Overall Score: <span className="text-blue-700 dark:text-blue-300">{score != null ? `${score}%` : "—"}</span></div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
            <button type="button" onClick={() => save("DRAFT")} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">Save as Draft</button>
            <button type="button" onClick={() => save("SUBMITTED")} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">Submit to Employee</button>
          </div>
        </div>
      </div>
    </div>
  );
}
