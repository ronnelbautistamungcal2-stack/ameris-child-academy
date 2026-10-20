import { MAX_FILE_BYTES, NAVY, toInputDate, uploadFile } from "@/components/ipp/ippUi";
import { apiJson } from "@/lib/api";
import {
  IPP_FOCUS_AREAS,
  IPP_FREQUENCIES,
  IPP_PLAN_TYPES,
  IPP_REVIEW_SCHEDULES,
  IPP_ROLES,
  IPP_STATUSES,
  IPP_STRATEGY_KINDS,
  MAX_LONG_TEXT,
} from "@/lib/ipp";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// New / Edit Progress Plan (client mockup 2026-10-02): Plan Information,
// Goals with their Strategies & Supports, and Documents.

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const label = `block text-sm font-bold ${NAVY}`;
const req = <span className="text-red-600"> *</span>;

function blankStrategy() {
  return { kind: "STRATEGY", text: "", role: "", frequency: "Daily", notes: "", documents: [] };
}

function blankGoal() {
  return { key: Math.random().toString(36).slice(2), id: null, title: "", domain: "", targetDate: "", progress: 0, strategies: [blankStrategy()] };
}

function formFromPlan(plan) {
  if (!plan) {
    return {
      childId: "",
      startDate: toInputDate(new Date()),
      reviewSchedule: "",
      status: "ACTIVE",
      planType: "",
      focusArea: "",
      purpose: "",
      measurableOutcomes: "",
      disciplinaryAction: "",
      goals: [blankGoal()],
    };
  }
  return {
    childId: plan.child.id,
    startDate: toInputDate(plan.startDate),
    reviewSchedule: plan.reviewSchedule,
    status: plan.status,
    planType: plan.planType,
    focusArea: plan.focusArea,
    purpose: plan.purpose,
    measurableOutcomes: plan.measurableOutcomes,
    disciplinaryAction: plan.disciplinaryAction || "",
    goals: plan.goals.map((g) => ({
      key: g.id,
      id: g.id,
      title: g.title,
      domain: g.domain,
      targetDate: toInputDate(g.targetDate),
      progress: g.progress,
      strategies: g.strategies.length ? g.strategies : [blankStrategy()],
    })),
  };
}

function withValue(options, value) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

function Counter({ value }) {
  return <div className="mt-0.5 text-right text-xs text-gray-500">{(value || "").length}/{MAX_LONG_TEXT}</div>;
}

export default function IppForm({ plan }) {
  const router = useRouter();
  const [form, setForm] = useState(() => formFromPlan(plan));
  const [selected, setSelected] = useState(0);
  const [children, setChildren] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]); // new plan: uploaded, saved with the plan
  const [docs, setDocs] = useState(plan?.documents || []); // existing plan: saved straight away
  const [docsOpen, setDocsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (plan) return;
    apiJson("/api/v1/ipp/children").then(setChildren).catch(() => setChildren([]));
  }, [plan]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const goal = form.goals[Math.min(selected, form.goals.length - 1)];
  const goalIndex = form.goals.indexOf(goal);
  const setGoal = (patch) => set({ goals: form.goals.map((g, i) => (i === goalIndex ? { ...g, ...patch } : g)) });
  const setStrategy = (j, patch) => setGoal({ strategies: goal.strategies.map((s, k) => (k === j ? { ...s, ...patch } : s)) });

  async function upload(file) {
    if (!file) return null;
    if (file.size > MAX_FILE_BYTES) {
      setError("Files can be up to 10 MB.");
      return null;
    }
    setUploading(true);
    setError("");
    try {
      return await uploadFile(file);
    } catch (e) {
      setError(e.message || "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function addPlanDocument(file) {
    const doc = await upload(file);
    if (!doc) return;
    if (!plan) {
      setPendingDocs((prev) => [...prev, { ...doc, notes: "" }]);
      return;
    }
    try {
      await apiJson(`/api/v1/ipp/${plan.id}/documents`, { method: "POST", body: JSON.stringify(doc) });
      const fresh = await apiJson(`/api/v1/ipp/${plan.id}`);
      setDocs(fresh.documents);
    } catch (e) {
      setError(e.message || "Could not add the document");
    }
  }

  async function removePlanDocument(doc, index) {
    if (!plan) {
      setPendingDocs((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    try {
      await apiJson(`/api/v1/ipp/${plan.id}/documents?documentId=${doc.id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      setError(e.message || "Could not remove the document");
    }
  }

  async function save() {
    if (!plan && !form.childId) return setError("Choose the child this plan is for.");
    setSaving(true);
    setError("");
    try {
      const body = { ...form, goals: form.goals.map(({ key, ...g }) => g) };
      let id = plan?.id;
      if (plan) {
        await apiJson(`/api/v1/ipp/${id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        id = (await apiJson("/api/v1/ipp", { method: "POST", body: JSON.stringify(body) })).id;
        for (const doc of pendingDocs) {
          await apiJson(`/api/v1/ipp/${id}/documents`, { method: "POST", body: JSON.stringify(doc) });
        }
      }
      router.push(`/staff/student-support/progress-plans/${id}`);
    } catch (e) {
      setError(e.message || "Could not save the plan");
      setSaving(false);
    }
  }

  const docList = plan ? docs : pendingDocs;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900">
        <h2 className={`bg-blue-50 px-5 py-3 text-2xl font-black dark:bg-gray-800 ${NAVY}`}>{"\u{1F4C4}"} Plan Information</h2>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          {plan ? (
            <div className={`${label} md:col-span-3`}>
              Student
              <div className="mt-1 text-base font-semibold text-gray-800 dark:text-gray-100">{plan.child.name}</div>
            </div>
          ) : (
            <label className={`${label} md:col-span-3`}>
              Student{req}
              <select value={form.childId} onChange={(e) => set({ childId: e.target.value })} className={`${input} mt-1 md:w-1/2`}>
                <option value="">Select a child...</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.classroom ? ` — ${c.classroom}` : ""}</option>
                ))}
              </select>
            </label>
          )}
          <label className={label}>
            Plan Start Date{req}
            <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={`${input} mt-1`} />
          </label>
          <label className={label}>
            Review Schedule{req}
            <select value={form.reviewSchedule} onChange={(e) => set({ reviewSchedule: e.target.value })} className={`${input} mt-1`}>
              <option value="">Select review schedule...</option>
              {IPP_REVIEW_SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className={label}>
            Status{req}
            <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={`${input} mt-1`}>
              {IPP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-1`}>
            Plan Type
            <select value={form.planType} onChange={(e) => set({ planType: e.target.value })} className={`${input} mt-1`}>
              <option value="">Select plan type...</option>
              {withValue(IPP_PLAN_TYPES, form.planType).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-2`}>
            Plan Focus Area
            <select value={form.focusArea} onChange={(e) => set({ focusArea: e.target.value })} className={`${input} mt-1`}>
              <option value="">Select focus area...</option>
              {withValue(IPP_FOCUS_AREAS, form.focusArea).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-3`}>
            Plan Purpose / Overview
            <textarea rows={3} maxLength={MAX_LONG_TEXT} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Enter the purpose or overview of this plan..." className={`${input} mt-1`} />
            <Counter value={form.purpose} />
          </label>
          <label className={`${label} md:col-span-1`}>
            Measurable Outcomes
            <textarea rows={3} maxLength={MAX_LONG_TEXT} value={form.measurableOutcomes} onChange={(e) => set({ measurableOutcomes: e.target.value })} placeholder="Enter the measurable outcomes for this plan..." className={`${input} mt-1`} />
            <Counter value={form.measurableOutcomes} />
          </label>
          <label className={`${label} md:col-span-2`}>
            Disciplinary Action
            <textarea rows={3} maxLength={MAX_LONG_TEXT} value={form.disciplinaryAction} onChange={(e) => set({ disciplinaryAction: e.target.value })} placeholder="Enter the disciplinary action to be taken if needed..." className={`${input} mt-1`} />
            <Counter value={form.disciplinaryAction} />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="bg-blue-50 px-5 py-3 dark:bg-gray-800">
          <h2 className={`text-2xl font-black ${NAVY}`}>{"\u{1F3AF}"} Goals, Strategies &amp; Supports</h2>
          <p className={`text-sm ${NAVY}`}>Add one or more goals with specific strategies and supports for each goal.</p>
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row">
          <div className="space-y-2 lg:w-60 lg:shrink-0">
            {form.goals.map((g, i) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setSelected(i)}
                aria-current={i === goalIndex ? "true" : undefined}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left ${
                  i === goalIndex ? "border-l-4 border-blue-600 bg-blue-50 dark:bg-gray-800" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                }`}
              >
                <span>
                  <span className={`block font-bold ${NAVY}`}>Goal {i + 1}</span>
                  <span className="block text-sm text-gray-600 dark:text-gray-400">{g.domain || g.title || "New goal"}</span>
                </span>
                <span aria-hidden className="text-gray-400">{"›"}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                set({ goals: [...form.goals, blankGoal()] });
                setSelected(form.goals.length);
              }}
              className="w-full rounded-lg border-2 border-blue-600 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300"
            >
              + Add Goal
            </button>
          </div>

          {goal && (
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-2xl font-black ${NAVY}`}>Goal {goalIndex + 1}</h3>
                <button
                  type="button"
                  disabled={form.goals.length <= 1}
                  onClick={() => {
                    set({ goals: form.goals.filter((_, i) => i !== goalIndex) });
                    setSelected(Math.max(0, goalIndex - 1));
                  }}
                  className="text-sm font-semibold text-red-600 disabled:opacity-30"
                >
                  {"\u{1F5D1}"} Remove Goal
                </button>
              </div>
              <div className="rounded-xl border border-blue-100 dark:border-gray-700">
                <div className={`bg-blue-50 px-4 py-2 font-bold dark:bg-gray-800 ${NAVY}`}>Goal Information</div>
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                  <label className={`${label} md:col-span-2`}>
                    Goal / Focus Area{req}
                    <input value={goal.title} onChange={(e) => setGoal({ title: e.target.value })} maxLength={300} placeholder="e.g. Improve communication skills to express needs and wants." className={`${input} mt-1`} />
                  </label>
                  <label className={label}>
                    Target Date
                    <input type="date" value={goal.targetDate} onChange={(e) => setGoal({ targetDate: e.target.value })} className={`${input} mt-1`} />
                  </label>
                  <label className={label}>
                    Goal Area{req}
                    <select value={goal.domain} onChange={(e) => setGoal({ domain: e.target.value })} className={`${input} mt-1`}>
                      <option value="">Select goal area...</option>
                      {withValue(IPP_FOCUS_AREAS, goal.domain).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  {plan && (
                    <label className={`${label} md:col-span-2`}>
                      Progress: {goal.progress}%
                      <input type="range" min="0" max="100" step="5" value={goal.progress} onChange={(e) => setGoal({ progress: Number(e.target.value) })} className="mt-1 w-full" />
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 px-4 py-2 dark:bg-gray-800">
                  <div>
                    <div className={`font-bold ${NAVY}`}>Strategies &amp; Supports</div>
                    <div className={`text-sm ${NAVY}`}>Add strategies and supports to help achieve this goal.</div>
                  </div>
                  <button type="button" onClick={() => setGoal({ strategies: [...goal.strategies, blankStrategy()] })} className="rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-gray-900 dark:text-blue-300">
                    + Add Strategy / Support
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className={`text-left text-xs font-bold ${NAVY}`}>
                        <th className="w-8 px-2 py-2">#</th>
                        <th className="px-2 py-2">Strategy / Support{req}</th>
                        <th className="w-32 px-2 py-2">Type</th>
                        <th className="w-40 px-2 py-2">Role Responsible</th>
                        <th className="w-40 px-2 py-2">Frequency</th>
                        <th className="px-2 py-2">Notes</th>
                        <th className="w-36 px-2 py-2">Documents</th>
                        <th className="w-12 px-2 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goal.strategies.map((s, j) => (
                        <tr key={j} className="border-t border-gray-100 align-top dark:border-gray-800">
                          <td className="px-2 py-2 font-bold">{j + 1}</td>
                          <td className="px-2 py-2">
                            <textarea rows={2} value={s.text} onChange={(e) => setStrategy(j, { text: e.target.value })} maxLength={500} aria-label={`Strategy or support ${j + 1}`} className={input} />
                          </td>
                          <td className="px-2 py-2">
                            <select value={s.kind} onChange={(e) => setStrategy(j, { kind: e.target.value })} aria-label="Type" className={input}>
                              {IPP_STRATEGY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select value={s.role} onChange={(e) => setStrategy(j, { role: e.target.value })} aria-label="Role responsible" className={input}>
                              <option value="">Select role...</option>
                              {withValue(IPP_ROLES, s.role).map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select value={s.frequency} onChange={(e) => setStrategy(j, { frequency: e.target.value })} aria-label="Frequency" className={input}>
                              <option value="">{"—"}</option>
                              {withValue(IPP_FREQUENCIES, s.frequency).map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <textarea rows={2} value={s.notes} onChange={(e) => setStrategy(j, { notes: e.target.value })} maxLength={500} aria-label="Notes" className={input} />
                          </td>
                          <td className="px-2 py-2">
                            {s.documents.map((d, k) => (
                              <div key={d.url} className="flex items-center gap-1 text-xs">
                                <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-700 hover:underline dark:text-blue-300">{d.name}</a>
                                <button type="button" onClick={() => setStrategy(j, { documents: s.documents.filter((_, x) => x !== k) })} aria-label={`Remove ${d.name}`} className="text-red-600">&times;</button>
                              </div>
                            ))}
                            <label className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-blue-700 dark:border-gray-600 dark:text-blue-300">
                              {"\u{1F4CE}"} Upload
                              <input
                                type="file"
                                className="sr-only"
                                disabled={uploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  const doc = await upload(file);
                                  if (doc) setStrategy(j, { documents: [...s.documents, doc] });
                                }}
                              />
                            </label>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button type="button" onClick={() => setGoal({ strategies: goal.strategies.filter((_, k) => k !== j) })} aria-label={`Remove strategy ${j + 1}`} className="text-lg text-red-600">
                              {"\u{1F5D1}"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button type="button" onClick={() => setDocsOpen((o) => !o)} aria-expanded={docsOpen} className="flex w-full items-center justify-between bg-blue-50 px-5 py-3 text-left dark:bg-gray-800">
          <span>
            <span className={`block text-2xl font-black ${NAVY}`}>{"\u{1F4C1}"} Documents</span>
            <span className={`block text-sm ${NAVY}`}>Upload and manage documents related to this progress plan (e.g., assessments, reports, meeting notes, etc.).</span>
          </span>
          <span aria-hidden className={NAVY}>{docsOpen ? "▲" : "▼"}</span>
        </button>
        {docsOpen && (
          <div className="space-y-2 p-5">
            {docList.map((d, i) => (
              <div key={d.id || d.url} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline dark:text-blue-300">{d.name}</a>
                <button type="button" onClick={() => removePlanDocument(d, i)} aria-label={`Remove ${d.name}`} className="text-red-600">{"\u{1F5D1}"}</button>
              </div>
            ))}
            <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-blue-300 px-4 py-5 text-center text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-800">
              <span className="font-semibold">{uploading ? "Uploading..." : "Click to upload a document"}</span>
              <span className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10 MB per file)</span>
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  addPlanDocument(file);
                }}
              />
            </label>
          </div>
        )}
      </section>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-blue-600 px-6 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-300">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving || uploading} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Saving..." : plan ? "Save Changes" : "Create Plan"}
        </button>
      </div>
    </div>
  );
}
