import { apiJson } from "@/lib/api";
import { COURSE_CORRECTION, offenseLabel } from "@/lib/characterGuide";
import { IPP_REQUEST_FIELDS } from "@/lib/dailyLogOptions";
import { useEffect, useMemo, useState } from "react";

// Daily Log fields for Course Correction (from the Character Guide decision
// trees) and IPP (Request IPP / Log IPP), client sheet 35. Shared by the
// teacher and coach Daily Log pages.

const control =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800";
const labelText = "mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500";

// My guess at the Area of Concern choices (the sheet only names the field).
export const IPP_AREAS = [
  "Behavior",
  "Social / Emotional",
  "Communication / Language",
  "Cognitive / Learning",
  "Physical / Motor",
  "Self-Care",
  "Attention / Focus",
  "Other",
];

export const EMPTY_COURSE_CORRECTION = { categoryId: "", behaviorId: "", branchId: "", offenseIndex: 0, location: "" };
export const EMPTY_IPP = { mode: "REQUEST", primaryConcern: "", areaOfConcern: "", previousSupports: "", strengths: "", planId: "", goalId: "", tactic: "", tacticOther: "", observation: "" };

/** The Character Guide's Course Correction behaviors and their categories. */
export function useCourseCorrectionGuide() {
  const [behaviors, setBehaviors] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiJson(`/api/v1/character-guide/behaviors?type=${COURSE_CORRECTION}`)
      .then((rows) => setBehaviors(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message || "Failed to load the Character Guide"));
  }, []);
  const categories = useMemo(() => {
    const byId = new Map();
    for (const b of behaviors || []) if (b.category) byId.set(b.category.id, b.category);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [behaviors]);
  return { behaviors, categories, error };
}

/** Details for a Course Correction entry, or throws with what is missing. */
export function courseCorrectionDetails(value, behaviors) {
  const behavior = (behaviors || []).find((b) => b.id === value.behaviorId);
  if (!value.categoryId) throw new Error("Select the type of behavior.");
  if (!behavior) throw new Error("Select which behavior it was.");
  const branch = behavior.tree?.branches?.find((b) => b.id === value.branchId);
  if (!branch) throw new Error(`Select the reason (${behavior.tree?.question?.prompt || "why it happened"}).`);
  const offense = branch.offenses?.[value.offenseIndex];
  if (!offense) throw new Error("Select which offense it was.");
  return {
    behaviorType: behavior.category?.name || "",
    categoryId: behavior.categoryId,
    behaviorId: behavior.id,
    behaviorName: behavior.name,
    behaviorLevel: String(behavior.level || 1),
    branchId: branch.id,
    branchTitle: branch.title,
    offense: value.offenseIndex + 1,
    steps: offense.steps,
    location: value.location.trim(),
  };
}

export function CourseCorrectionFields({ value, onChange, guide }) {
  const { behaviors, categories, error } = guide;
  const set = (patch) => onChange({ ...value, ...patch });
  const inCategory = (behaviors || []).filter((b) => b.categoryId === value.categoryId);
  const behavior = inCategory.find((b) => b.id === value.behaviorId);
  const branches = behavior?.tree?.branches || [];
  const branch = branches.find((b) => b.id === value.branchId);
  const offenses = branch?.offenses || [];
  const steps = offenses[value.offenseIndex]?.steps || [];

  if (error) return <div className="text-sm text-red-700 sm:col-span-2">{error}</div>;
  if (behaviors && !behaviors.length) {
    return <div className="text-sm text-amber-800 sm:col-span-2">No Course Correction behaviors are in the Character Guide yet. Ask an admin to add them.</div>;
  }
  return (
    <>
      <label className="block">
        <div className={labelText}>Type</div>
        <select aria-label="Course correction type" value={value.categoryId} onChange={(e) => set({ categoryId: e.target.value, behaviorId: "", branchId: "", offenseIndex: 0 })} className={control}>
          <option value="">Select a type...</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <div className={labelText}>Behavior</div>
        <select aria-label="Behavior" value={value.behaviorId} onChange={(e) => set({ behaviorId: e.target.value, branchId: "", offenseIndex: 0 })} disabled={!value.categoryId} className={`${control} disabled:opacity-50`}>
          <option value="">Select the behavior...</option>
          {inCategory.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      {behavior ? (
        <>
          <label className="block">
            <div className={labelText}>Reason</div>
            <select aria-label="Reason" value={value.branchId} onChange={(e) => set({ branchId: e.target.value, offenseIndex: 0 })} className={control}>
              <option value="">{behavior.tree?.question?.prompt || "Select the reason..."}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          <label className="block">
            <div className={labelText}>Offense</div>
            <select aria-label="Offense" value={value.offenseIndex} onChange={(e) => set({ offenseIndex: Number(e.target.value) })} disabled={!branch} className={`${control} disabled:opacity-50`}>
              {(offenses.length ? offenses : [{ id: "none" }]).map((o, i) => <option key={o.id} value={i}>{offenseLabel(i)}</option>)}
            </select>
          </label>
        </>
      ) : null}
      <label className="block sm:col-span-2">
        <div className={labelText}>Location</div>
        <input aria-label="Location" value={value.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Playground, block center" className={control} />
      </label>
      {behavior ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-[#0b2a5b] sm:col-span-2 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          {behavior.tree?.intro ? <div className="font-semibold">{behavior.tree.intro}</div> : null}
          {branch ? (
            <>
              <div className="mt-1 font-bold">{branch.title} — {offenseLabel(value.offenseIndex)}: follow these steps</div>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5" aria-label="Steps to follow">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          ) : (
            <div className="mt-1">{behavior.tree?.question?.title}: {behavior.tree?.question?.prompt}</div>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The child's current IPPs with goals and strategies (Log IPP). */
export function useChildPlans(childId, enabled) {
  const [state, setState] = useState({ childId: "", plans: null, error: "" });
  useEffect(() => {
    if (!enabled || !childId) return undefined;
    let cancelled = false;
    setState({ childId, plans: null, error: "" });
    (async () => {
      try {
        const list = await apiJson(`/api/v1/ipp?childId=${encodeURIComponent(childId)}`);
        const plans = await Promise.all((list.plans || []).map((p) => apiJson(`/api/v1/ipp/${p.id}`)));
        if (!cancelled) setState({ childId, plans, error: "" });
      } catch (e) {
        if (!cancelled) setState({ childId, plans: [], error: e.message || "Failed to load the child's IPP" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, enabled]);
  return state.childId === childId ? state : { plans: null, error: "" };
}

/** Details for an IPP entry, or throws with what is missing. */
export function ippDetails(value, plans) {
  const text = (k) => String(value[k] || "").trim();
  if (value.mode === "REQUEST") {
    if (!text("primaryConcern")) throw new Error("Enter the primary concern.");
    if (!text("areaOfConcern")) throw new Error("Choose the area of concern.");
    return { kind: "REQUEST", primaryConcern: text("primaryConcern"), areaOfConcern: text("areaOfConcern"), previousSupports: text("previousSupports"), strengths: text("strengths") };
  }
  const plan = (plans || []).find((p) => p.id === value.planId) || (plans?.length === 1 ? plans[0] : null);
  if (!plan) throw new Error("This child has no current IPP to log against.");
  const goal = plan.goals.find((g) => g.id === value.goalId);
  if (!goal) throw new Error("Select the goal.");
  const tactic = value.tactic === "__other" ? text("tacticOther") : text("tactic");
  if (!tactic) throw new Error("Select or enter the tactic used.");
  return { kind: "LOG", planId: plan.id, goalId: goal.id, goalTitle: goal.title, tactic, observation: text("observation") };
}

export function IppFields({ value, onChange, childIds, plansState }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const isLog = value.mode === "LOG";
  const childId = childIds.length === 1 ? childIds[0] : "";
  const { plans, error } = plansState;
  const plan = plans?.find((p) => p.id === value.planId) || (plans?.length === 1 ? plans[0] : null);
  const goal = plan?.goals.find((g) => g.id === value.goalId);
  const tactics = (goal?.strategies || []).filter((s) => s.kind === "STRATEGY" || !s.kind);

  return (
    <>
      <div className="sm:col-span-2">
        <div className={labelText}>IPP</div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="radiogroup" aria-label="IPP entry">
          {[
            ["REQUEST", "Request IPP"],
            ["LOG", "Log IPP"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={value.mode === mode}
              onClick={() => set({ mode })}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${value.mode === mode ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!isLog ? (
        IPP_REQUEST_FIELDS.map((f) =>
          f.key === "areaOfConcern" ? (
            <label key={f.key} className="block">
              <div className={labelText}>{f.label}</div>
              <select aria-label="Area of Concern" value={value.areaOfConcern} onChange={(e) => set({ areaOfConcern: e.target.value })} className={control}>
                <option value="">Select an area...</option>
                {IPP_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          ) : (
            <label key={f.key} className={`block ${f.key === "primaryConcern" ? "" : "sm:col-span-2"}`}>
              <div className={labelText}>{f.label}</div>
              {f.key === "primaryConcern" ? (
                <input value={value[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} className={control} />
              ) : (
                <textarea value={value[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} rows={2} className={control} />
              )}
            </label>
          ),
        )
      ) : !childId ? (
        <div className="text-sm text-amber-800 sm:col-span-2">Select one child to log against their IPP.</div>
      ) : error ? (
        <div className="text-sm text-red-700 sm:col-span-2">{error}</div>
      ) : !plans ? (
        <div className="text-sm text-gray-500 sm:col-span-2">Loading the child&apos;s IPP...</div>
      ) : !plans.length ? (
        <div className="text-sm text-amber-800 sm:col-span-2">This child has no current IPP. Use Request IPP to ask for one.</div>
      ) : (
        <>
          {plans.length > 1 ? (
            <label className="block sm:col-span-2">
              <div className={labelText}>Plan</div>
              <select aria-label="Plan" value={value.planId} onChange={(e) => set({ planId: e.target.value, goalId: "", tactic: "" })} className={control}>
                <option value="">Select the plan...</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.focusArea || p.planType || "Progress Plan"}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block">
            <div className={labelText}>Goal</div>
            <select aria-label="Goal" value={value.goalId} onChange={(e) => set({ goalId: e.target.value, tactic: "" })} disabled={!plan} className={`${control} disabled:opacity-50`}>
              <option value="">Select the goal...</option>
              {(plan?.goals || []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
          <label className="block">
            <div className={labelText}>Tactic Used</div>
            <select aria-label="Tactic Used" value={value.tactic} onChange={(e) => set({ tactic: e.target.value })} disabled={!goal} className={`${control} disabled:opacity-50`}>
              <option value="">Select the tactic...</option>
              {tactics.map((s) => <option key={s.id} value={s.text}>{s.text}</option>)}
              <option value="__other">Other</option>
            </select>
          </label>
          {value.tactic === "__other" ? (
            <label className="block sm:col-span-2">
              <div className={labelText}>Other tactic</div>
              <input value={value.tacticOther} onChange={(e) => set({ tacticOther: e.target.value })} className={control} />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <div className={labelText}>Observation Notes</div>
            <textarea value={value.observation} onChange={(e) => set({ observation: e.target.value })} rows={3} className={control} />
          </label>
        </>
      )}
    </>
  );
}

