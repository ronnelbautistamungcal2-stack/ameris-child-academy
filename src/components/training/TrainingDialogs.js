import { ChipSelect, MaterialsEditor, Modal, NAVY, control } from "@/components/training/trainingUi";
import { apiJson } from "@/lib/api";
import { PATHWAY_CATEGORIES, TRAINING_AGE_GROUPS, TRAINING_CATEGORIES, TRAINING_ROLE_OPTIONS, TRAINING_TYPES } from "@/lib/training";
import { useState } from "react";

// Add/Edit Training and Add/Edit Training Pathway pop-ups (client mockups
// 15 and 17, admins only).

const label = "block text-sm font-bold text-[#0b2a5b] dark:text-blue-100";
const req = <span className="text-red-500"> *</span>;

export function TrainingDialog({ centerId, training, pathways, defaultPathwayId, onClose, onSaved }) {
  const isEdit = Boolean(training?.id);
  const [form, setForm] = useState(() => ({
    title: training?.title || "",
    category: training?.category || "",
    description: training?.description || "",
    type: training?.type || "REQUIRED",
    appliesToRoles: training?.appliesToRoles || [],
    ageGroups: training?.ageGroups || [],
    pathwayIds: training?.pathwayIds || (defaultPathwayId ? [defaultPathwayId] : []),
    dueDate: training?.dueDate || "",
    hours: training?.hours ?? "",
    observationRequired: Boolean(training?.observationRequired),
    handsOnRequired: Boolean(training?.handsOnRequired),
    materials: training?.materials || [],
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await apiJson(`/api/v1/training/items/${training.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiJson("/api/v1/training/items", { method: "POST", body: JSON.stringify({ ...form, centerId }) });
      }
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the training");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Edit Training" : "Add Training"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Training"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Training Title{req}
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Enter training title..." className={control} />
          </label>
          <label className={label}>
            Category{req}
            <input value={form.category} onChange={(e) => set({ category: e.target.value })} list="training-categories" placeholder="Enter category (e.g. Health & Safety)..." className={control} />
            <datalist id="training-categories">
              {TRAINING_CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>
        <label className={label}>
          Description{req}
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value.slice(0, 500) })} placeholder="Enter a description of the training..." className={control} />
          <span className="block text-right text-xs font-normal text-gray-500">{form.description.length}/500</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={label}>
            Applies To (Roles)
            <ChipSelect value={form.appliesToRoles} onChange={(v) => set({ appliesToRoles: v })} options={TRAINING_ROLE_OPTIONS} placeholder="All Roles" label="Applies to roles" />
          </div>
          <div className={label}>
            Age Group(s)
            <ChipSelect value={form.ageGroups} onChange={(v) => set({ ageGroups: v })} options={TRAINING_AGE_GROUPS} placeholder="All Age Groups" label="Age groups" />
          </div>
        </div>
        <div className={label}>
          Assign to Pathway(s)
          <ChipSelect value={form.pathwayIds} onChange={(v) => set({ pathwayIds: v })} options={pathways.map((p) => ({ value: p.id, label: p.title }))} placeholder="Select one or more training pathways..." label="Pathways" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Type
            <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={control}>
              {TRAINING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className={label}>
            Due Date
            <input type="date" value={form.dueDate || ""} onChange={(e) => set({ dueDate: e.target.value })} className={control} />
          </label>
          <label className={label}>
            # Hours
            <input type="number" min="0" step="0.25" value={form.hours} onChange={(e) => set({ hours: e.target.value })} className={control} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["observationRequired", "Observation Requirement", "Select whether this training requires staff to be observed by a supervisor to be marked as complete.", "No observation required", "Observation required", "bg-blue-50"],
            ["handsOnRequired", "Hands-On Training Requirement", "Select whether this training requires hands-on experience with a supervisor to be marked as complete.", "No hands-on training required", "Hands-on training required", "bg-violet-50"],
          ].map(([key, title, hint, no, yes, tone]) => (
            <fieldset key={key} className={`rounded-xl p-3 ${tone} dark:bg-gray-800`}>
              <legend className={`text-sm font-bold ${NAVY}`}>{title}</legend>
              <p className="text-xs text-gray-600 dark:text-gray-400">{hint}</p>
              {[[false, no], [true, yes]].map(([value, text]) => (
                <label key={String(value)} className="mt-1 flex items-center gap-2 text-sm">
                  <input type="radio" name={key} checked={form[key] === value} onChange={() => set({ [key]: value })} />
                  {text}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <MaterialsEditor value={form.materials} onChange={(v) => set({ materials: v })} />
      </div>
    </Modal>
  );
}

export function PathwayDialog({ centerId, pathway, onClose, onSaved }) {
  const isEdit = Boolean(pathway?.id);
  const [form, setForm] = useState(() => ({
    title: pathway?.title || "",
    category: pathway?.category || "",
    description: pathway?.description || "",
    appliesToRoles: pathway?.appliesToRoles || [],
    ageGroups: pathway?.ageGroups || [],
    materials: pathway?.materials || [],
    active: pathway ? pathway.active : true,
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (isEdit) await apiJson(`/api/v1/training/pathways/${pathway.id}`, { method: "PUT", body: JSON.stringify(form) });
      else await apiJson("/api/v1/training/pathways", { method: "POST", body: JSON.stringify({ ...form, centerId }) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the pathway");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Edit Training Pathway" : "Add Training Pathway"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Pathway"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Pathway Name{req}
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Enter pathway name..." className={control} />
          </label>
          <label className={label}>
            Category{req}
            <input value={form.category} onChange={(e) => set({ category: e.target.value })} list="pathway-categories" placeholder="Select a category..." className={control} />
            <datalist id="pathway-categories">
              {PATHWAY_CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>
        <label className={label}>
          Description{req}
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value.slice(0, 500) })} placeholder="Enter a description of the training pathway..." className={control} />
          <span className="block text-right text-xs font-normal text-gray-500">{form.description.length}/500</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={label}>
            Applies To (Roles)
            <ChipSelect value={form.appliesToRoles} onChange={(v) => set({ appliesToRoles: v })} options={TRAINING_ROLE_OPTIONS} placeholder="All Staff" label="Applies to roles" />
          </div>
          <div className={label}>
            Age Group(s) <span className="font-normal text-gray-500">(Optional)</span>
            <ChipSelect value={form.ageGroups} onChange={(v) => set({ ageGroups: v })} options={TRAINING_AGE_GROUPS} placeholder="All Ages" label="Age groups" />
          </div>
        </div>
        <MaterialsEditor value={form.materials} onChange={(v) => set({ materials: v })} />
        <label className={`${label} max-w-xs`}>
          Status
          <select value={form.active ? "ACTIVE" : "INACTIVE"} onChange={(e) => set({ active: e.target.value === "ACTIVE" })} className={control}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}
