import { apiJson } from "@/lib/api";
import {
  BEHAVIOR_LEVELS,
  BEHAVIOR_TYPES,
  BRANCH_TONES,
  CHARACTER_HIGHLIGHT,
  COURSE_CORRECTION,
  DEFAULT_REWARDS,
  emptyTree,
  newId,
  offenseLabel,
} from "@/lib/characterGuide";
import { useState } from "react";

// Add / Edit Behavior popup (client mockups 40-01..07): the behavior's details
// and its decision tree. Every box is editable; branches, offenses and
// reward options can be added or removed.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const boxInput = "w-full rounded-md border border-white/80 bg-white/90 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800";

export default function BehaviorEditor({ behavior, categories, onClose, onSaved }) {
  const isNew = !behavior?.id;
  const [form, setForm] = useState(() => ({
    type: behavior?.type || COURSE_CORRECTION,
    name: behavior?.name || "",
    categoryId: behavior?.categoryId || behavior?.category?.id || "",
    level: behavior?.level || 1,
    description: behavior?.description || "",
    tree: behavior?.tree || emptyTree(behavior?.type || COURSE_CORRECTION),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const highlight = form.type === CHARACTER_HIGHLIGHT;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTree = (fn) => setForm((f) => ({ ...f, tree: fn(f.tree) }));
  const setBranch = (id, fn) => setTree((t) => ({ ...t, branches: t.branches.map((b) => (b.id === id ? fn(b) : b)) }));

  function changeType(type) {
    if (type === form.type) return;
    // Switching type swaps in the matching tree shape (branch titles kept).
    const fresh = emptyTree(type, form.name);
    const branches = form.tree.branches.map((b) => ({ ...fresh.branches[0], id: b.id, title: b.title, prompt: b.prompt }));
    set({ type, tree: { ...fresh, intro: form.tree.intro, branches } });
  }

  function addBranch() {
    const fresh = emptyTree(form.type).branches[0];
    setTree((t) => ({ ...t, branches: [...t.branches, fresh] }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify(form);
      const saved = isNew
        ? await apiJson("/api/v1/character-guide/behaviors", { method: "POST", body })
        : await apiJson(`/api/v1/character-guide/behaviors/${behavior.id}`, { method: "PUT", body });
      onSaved(saved);
    } catch (e) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  }

  const noun = highlight ? "Highlight" : "Behavior";
  const title = `${isNew ? "Add" : "Edit"} ${highlight ? "Character Highlight" : "Behavior"}`;
  const label = "block text-sm font-bold text-[#1d4ed8] dark:text-blue-200";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 pb-3 pt-5 dark:border-gray-700">
          <div>
            <h2 className={`text-3xl font-black ${NAVY}`}>{title}</h2>
            <p className="text-sm text-[#1d4ed8] dark:text-blue-200">
              {highlight
                ? "Create a character highlight to celebrate positive behavior. You can edit the text, add or remove boxes, and adjust the flow."
                : "Create a decision tree to guide teachers in responding to this behavior. You can edit the text, add or remove boxes, and adjust the flow."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-3xl leading-none text-[#1d4ed8]">×</button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr]">
            <label className={label}>Category <span className="text-red-600">*</span>
              <select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={`${control} mt-1`}>
                <option value="">Select a category...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>{noun} Name <span className="text-red-600">*</span>
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={`${control} mt-1`} />
            </label>
            <fieldset>
              <legend className={label}>Type <span className="text-red-600">*</span></legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {BEHAVIOR_TYPES.map((t) => {
                  const on = form.type === t.value;
                  const tone = t.value === COURSE_CORRECTION ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30";
                  return (
                    <label key={t.value} className={`flex cursor-pointer gap-2 rounded-lg border-2 px-3 py-2 ${on ? tone : "border-gray-200 dark:border-gray-700"}`}>
                      <input type="radio" name="behavior-type" checked={on} onChange={() => changeType(t.value)} className="mt-1" />
                      <span>
                        <span className="block text-sm font-bold">{t.label}</span>
                        <span className="block text-xs text-gray-600 dark:text-gray-300">{t.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_4fr]">
            <label className={label}>Level <span className="text-red-600">*</span>
              <select value={form.level} onChange={(e) => set({ level: Number(e.target.value) })} className={`${control} mt-1`}>
                {BEHAVIOR_LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </label>
            <label className={label}>Description <span className="text-red-600">*</span>
              <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} className={`${control} mt-1`} />
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4 dark:border-gray-700 dark:bg-gray-950/40">
            <div className="mx-auto max-w-xl space-y-0">
              <div className={`rounded-lg border-2 px-4 py-2 text-center ${highlight ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-400 bg-red-50 dark:bg-red-950/30"}`}>
                <div className={`text-lg font-bold ${NAVY}`}>{form.name || `${noun} name`}</div>
                <input value={form.tree.intro} onChange={(e) => setTree((t) => ({ ...t, intro: e.target.value }))} placeholder="A short note for the teacher..." aria-label="Opening note" className={`${boxInput} mt-1 text-center`} />
              </div>
              <Arrow />
              <div className="rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-2 text-center dark:bg-blue-950/30">
                <input value={form.tree.question.title} onChange={(e) => setTree((t) => ({ ...t, question: { ...t.question, title: e.target.value } }))} aria-label="Step title" className={`${boxInput} text-center font-bold text-[#1d4ed8]`} />
                <textarea value={form.tree.question.prompt} onChange={(e) => setTree((t) => ({ ...t, question: { ...t.question, prompt: e.target.value } }))} rows={1} aria-label="Step question" className={`${boxInput} mt-1 text-center`} />
              </div>
            </div>
            <Arrow />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {form.tree.branches.map((b, i) => (
                <Branch
                  key={b.id}
                  branch={b}
                  index={i}
                  highlight={highlight}
                  onChange={(fn) => setBranch(b.id, fn)}
                  onRemove={form.tree.branches.length > 1 ? () => setTree((t) => ({ ...t, branches: t.branches.filter((x) => x.id !== b.id) })) : null}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" onClick={addBranch} className="rounded-lg border-2 border-[#1d4ed8] px-5 py-2 text-sm font-bold text-[#1d4ed8] dark:text-blue-200">+ Add Branch</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border-2 border-[#0b2a5b] px-6 py-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#1d4ed8] px-6 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Saving..." : `Save ${noun}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return <div className="mx-auto h-4 w-0.5 bg-[#1d4ed8]" aria-hidden="true" />;
}

function Trash({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="shrink-0 rounded px-1 text-red-600 hover:bg-red-50">🗑</button>
  );
}

function Branch({ branch, index, highlight, onChange, onRemove }) {
  const tone = BRANCH_TONES[index % BRANCH_TONES.length];
  const name = branch.title || `Branch ${index + 1}`;
  return (
    <div className="space-y-0">
      <div className={`rounded-lg border-2 p-2 ${tone}`}>
        <div className="flex items-center gap-1">
          <input value={branch.title} onChange={(e) => onChange((b) => ({ ...b, title: e.target.value }))} placeholder={highlight ? "Trait (e.g. Honesty)" : "Reason (e.g. Frustration)"} aria-label={`Branch ${index + 1} title`} className={`${boxInput} text-center font-bold`} />
          {onRemove ? <Trash onClick={onRemove} label={`Remove ${name}`} /> : null}
        </div>
        <textarea value={branch.prompt} onChange={(e) => onChange((b) => ({ ...b, prompt: e.target.value }))} rows={2} placeholder="Question for the teacher..." aria-label={`${name} question`} className={`${boxInput} mt-1`} />
      </div>
      {highlight ? <HighlightSteps branch={branch} tone={tone} name={name} onChange={onChange} /> : <Offenses branch={branch} tone={tone} name={name} onChange={onChange} />}
    </div>
  );
}

function Offenses({ branch, tone, name, onChange }) {
  const setOffense = (id, steps) => onChange((b) => ({ ...b, offenses: b.offenses.map((o) => (o.id === id ? { ...o, steps } : o)) }));
  return (
    <>
      {branch.offenses.map((o, i) => (
        <div key={o.id}>
          <Arrow />
          <div className={`rounded-lg border-2 p-2 ${tone}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0b2a5b] dark:text-blue-100">{offenseLabel(i)}</span>
              {branch.offenses.length > 1 ? (
                <Trash onClick={() => onChange((b) => ({ ...b, offenses: b.offenses.filter((x) => x.id !== o.id) }))} label={`Remove ${name} ${offenseLabel(i)}`} />
              ) : null}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Follow these steps (one per line):</span>
            <textarea
              value={o.steps.join("\n")}
              onChange={(e) => setOffense(o.id, e.target.value.split("\n"))}
              rows={Math.max(3, o.steps.length + 1)}
              aria-label={`${name} ${offenseLabel(i)} steps`}
              className={`${boxInput} mt-1`}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange((b) => ({ ...b, offenses: [...b.offenses, { id: newId("o"), steps: [""] }] }))}
        className="mt-2 w-full rounded-lg border-2 border-[#1d4ed8] bg-white py-1.5 text-sm font-bold text-[#1d4ed8] dark:bg-gray-900 dark:text-blue-200"
      >
        + Add Offense
      </button>
    </>
  );
}

function HighlightSteps({ branch, tone, name, onChange }) {
  const [draft, setDraft] = useState("");
  const rewards = branch.rewards || DEFAULT_REWARDS;
  function addReward() {
    const text = draft.trim();
    if (!text) return;
    onChange((b) => ({ ...b, rewards: [...(b.rewards || []), text] }));
    setDraft("");
  }
  return (
    <>
      <Arrow />
      <div className={`rounded-lg border-2 p-2 ${tone}`}>
        <div className="text-center font-bold text-[#0b2a5b] dark:text-blue-100">Celebrate with Praise</div>
        <textarea value={branch.praisePrompt || ""} onChange={(e) => onChange((b) => ({ ...b, praisePrompt: e.target.value }))} rows={2} aria-label={`${name} praise prompt`} className={`${boxInput} mt-1`} />
      </div>
      <Arrow />
      <div className={`rounded-lg border-2 p-2 ${tone}`}>
        <div className="text-center font-bold text-[#0b2a5b] dark:text-blue-100">Choose a Reward</div>
        <ul className="mt-1 space-y-1 text-sm">
          {rewards.map((r, i) => (
            <li key={`${r}-${i}`} className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-400" aria-hidden="true" />
              <span className="flex-1">{r}</span>
              <Trash onClick={() => onChange((b) => ({ ...b, rewards: rewards.filter((_, j) => j !== i) }))} label={`Remove ${r} from ${name}`} />
            </li>
          ))}
          <li className="flex items-center gap-2 text-gray-500">
            <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-400" aria-hidden="true" />
            Other: <span className="flex-1 border-b border-gray-300" />
          </li>
        </ul>
        <div className="mt-2 flex gap-1">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReward())} placeholder="New reward option" aria-label={`New reward option for ${name}`} className={boxInput} />
          <button type="button" onClick={addReward} className="shrink-0 rounded-lg border-2 border-[#1d4ed8] bg-white px-2 text-sm font-bold text-[#1d4ed8] dark:bg-gray-900 dark:text-blue-200">+ Add Reward Option</button>
        </div>
      </div>
    </>
  );
}
