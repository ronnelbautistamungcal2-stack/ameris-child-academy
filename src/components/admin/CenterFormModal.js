import { apiJson } from "@/lib/api";
import {
  CENTER_ROLE_OPTIONS,
  CENTER_STATUSES,
  CENTER_TYPES,
  DAYS,
  defaultCareSchedule,
  defaultMeals,
  formatAgeMonths,
  MAX_AGE_MONTHS,
  MEALS,
} from "@/lib/centerSettings";
import { roleLabel } from "@/lib/roles";
import { DEFAULT_STAFF_GRADE_WEIGHTS, STAFF_GRADE_PARTS } from "@/lib/staffGrade";
import { useEffect, useMemo, useState } from "react";

// Add Center / Edit Center (client mockups 2026-10-02): Basic Information,
// Care & Schedule, Ages & Rates and Roles. Editing opens the same tabs filled
// in with the center's information.

const TABS = [
  { key: "basic", label: "Basic Information", icon: "\u{1F3E0}" },
  { key: "care", label: "Care & Schedule", icon: "\u{1F4C5}" },
  { key: "rates", label: "Ages & Rates", icon: "\u{1F465}" },
  { key: "roles", label: "Roles", icon: "\u{1F464}" },
  { key: "grade", label: "Staff Grade", icon: "\u{1F4CA}" },
];

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

const ROLE_DESCRIPTIONS = {
  ADMIN: "Full access to center settings, staff, children, reports, and all features.",
  COACH: "Support staff with coaching, observations, and development plans.",
  PARENT: "View their child's information, attendance, meals, messages, and center updates.",
  OTHER_STAFF: "General staff access with assigned permissions.",
  HR_STAFF: "Manage staff records, employment information, and HR-related tasks.",
  STUDENT_SUPPORT: "Manage child development plans, progress tracking, and support services.",
  KITCHEN_STAFF: "Access to meal planning, menus, food counts, and kitchen-related features.",
  TEACHER: "Manage classroom activities, attendance, lessons, and child progress.",
};

// Meal age group choices: every month to 23 months, then whole years to 18.
const AGE_CHOICES = [
  ...Array.from({ length: 24 }, (_, i) => i),
  ...Array.from({ length: (MAX_AGE_MONTHS - 24) / 12 + 1 }, (_, i) => 24 + i * 12),
];

const DEFAULT_RATES = [
  "0-23 Months",
  "2-Year-Olds",
  "3-Year-Olds",
  "4-Year-Olds",
  "5-Year-Olds",
  "6-Year-Olds and Up",
].map((label) => ({ label, monthly: "", weekly: "", daily: "", hourly: "" }));

function formFromCenter(center) {
  return {
    name: center?.name || "",
    centerType: center?.centerType || "",
    status: center?.status || "ACTIVE",
    photoUrl: center?.photoUrl || "",
    address: center?.address || "",
    city: center?.city || "",
    state: center?.state || "",
    zip: center?.zip || "",
    directorId: center?.directorId || "",
    contactEmail: center?.contactEmail || "",
    phone: center?.phone || "",
    classroomCount: center?.classroomCount ?? "",
    capacity: center?.capacity ?? "",
    region: center?.region || "",
    notes: center?.notes || "",
    careSchedule: center?.careSchedule || defaultCareSchedule(),
    autoCheckoutTime: center?.autoCheckoutTime || "",
    mealAgeGroups: center?.mealAgeGroups || [],
    meals: { ...defaultMeals(), ...(center?.meals || {}) },
    ageRates: (center?.ageRates || (center ? [] : DEFAULT_RATES)).map((r) => ({
      label: r.label,
      monthly: r.monthly ?? "",
      weekly: r.weekly ?? "",
      daily: r.daily ?? "",
      hourly: r.hourly ?? "",
    })),
    enrollmentFee: center?.enrollmentFee ?? "",
    roleAccess: center?.roleAccess || [],
    staffGradeWeights: { ...DEFAULT_STAFF_GRADE_WEIGHTS, ...(center?.staffGradeWeights || {}) },
  };
}

// The first tab with a missing required field, so Save can jump to it.
function missingRequired(form) {
  const basic = [
    ["name", "Center name"],
    ["centerType", "Center type"],
    ["address", "Address"],
    ["city", "City"],
    ["state", "State"],
    ["zip", "ZIP code"],
    ["directorId", "Director"],
  ];
  const missing = basic.find(([key]) => !String(form[key] || "").trim());
  return missing ? { tab: "basic", message: `${missing[1]} is required.` } : null;
}

const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

function Field({ label, required, optional, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-blue-950 dark:text-gray-200">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {optional ? <span className="font-normal text-gray-500"> (Optional)</span> : null}
      </span>
      {children}
    </label>
  );
}

function Section({ icon, title, description, action, children }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 rounded-t-xl bg-blue-50/70 px-4 py-3 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">{icon}</span>
          <div>
            <h3 className="text-base font-bold text-blue-950 dark:text-white">{title}</h3>
            {description ? <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// Staff Overall Grade weights (client request 2026-10-22): how much each part
// counts toward every staff member's overall grade at this center.
function StaffGradeSection({ weights, onChange }) {
  const total = STAFF_GRADE_PARTS.reduce((sum, { key }) => sum + (Number(weights[key]) || 0), 0);
  const ok = Math.abs(total - 100) < 0.01;
  return (
    <Section icon={"\u{1F4CA}"} title="Staff Overall Grade" description="Set how much each part counts toward a staff member's overall grade. The percentages must add up to 100.">
      <div className="grid gap-3 sm:grid-cols-5">
        {STAFF_GRADE_PARTS.map(({ key, label }) => (
          <Field key={key} label={`% ${label}`}>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              className={input}
              value={weights[key]}
              onChange={(e) => onChange({ [key]: e.target.value === "" ? "" : Number(e.target.value) })}
              aria-label={`${label} percent`}
            />
          </Field>
        ))}
      </div>
      <p className={`mt-2 text-sm font-semibold ${ok ? "text-green-700" : "text-red-600"}`}>Total: {total}%{ok ? "" : " (must be 100%)"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Points taken off per citation">
          <input type="number" min="0" max="100" className={input} value={weights.citationPoints} onChange={(e) => onChange({ citationPoints: e.target.value === "" ? "" : Number(e.target.value) })} />
        </Field>
        <Field label="Points per commendation">
          <input type="number" min="0" max="100" className={input} value={weights.commendationPoints} onChange={(e) => onChange({ commendationPoints: e.target.value === "" ? "" : Number(e.target.value) })} />
        </Field>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
        <li><strong>Evaluations:</strong> the latest evaluation score out of 10.</li>
        <li><strong>Checklist:</strong> the share of due checklist items ticked on the days worked.</li>
        <li><strong>Citations:</strong> starts at 100% and loses the points above for each citation in the period.</li>
        <li><strong>Commendations:</strong> the points above for each commendation in the period, up to 100%.</li>
        <li><strong>HR:</strong> hours worked out of scheduled shift hours.</li>
        <li>A part with no data yet (for example no evaluation) is left out and the others are scaled up.</li>
      </ul>
    </Section>
  );
}

export default function CenterFormModal({ center, onClose, onSaved }) {
  const editing = Boolean(center?.id);
  const [tab, setTab] = useState("basic");
  const [form, setForm] = useState(() => formFromCenter(center));
  const [staff, setStaff] = useState([]);
  const [regions, setRegions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/users?staffOnly=true")
      .then((users) => setStaff((Array.isArray(users) ? users : []).filter((u) => !u.disabled)))
      .catch(() => setStaff([]));
    apiJson("/api/v1/centers")
      .then((list) => setRegions([...new Set((Array.isArray(list) ? list : []).map((c) => c.region).filter(Boolean))].sort()))
      .catch(() => setRegions([]));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const tabIndex = TABS.findIndex((t) => t.key === tab);
  const isLast = tabIndex === TABS.length - 1;

  const directorOptions = useMemo(() => {
    const list = [...staff];
    if (center?.director && !list.some((u) => u.id === center.director.id)) list.unshift(center.director);
    return list;
  }, [staff, center?.director]);

  async function uploadPhoto(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
      });
      set({ photoUrl: result.url });
    } catch (e) {
      setError(e.message || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const missing = missingRequired(form);
    if (missing) {
      setTab(missing.tab);
      setError(missing.message);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        classroomCount: form.classroomCount === "" ? null : form.classroomCount,
        capacity: form.capacity === "" ? null : form.capacity,
        enrollmentFee: form.enrollmentFee === "" ? null : form.enrollmentFee,
        directorId: form.directorId || null,
      };
      const saved = await apiJson(editing ? `/api/v1/centers/${center.id}` : "/api/v1/centers", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved?.(saved);
    } catch (e) {
      setError(e.message || "Failed to save the center");
    } finally {
      setSaving(false);
    }
  }

  const updateDay = (key, patch) =>
    set({ careSchedule: { ...form.careSchedule, [key]: { ...form.careSchedule[key], ...patch } } });
  const updateMeal = (key, patch) => set({ meals: { ...form.meals, [key]: { ...form.meals[key], ...patch } } });
  const updateRate = (i, patch) => set({ ageRates: form.ageRates.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const updateAgeGroup = (i, patch) =>
    set({ mealAgeGroups: form.mealAgeGroups.map((g, j) => (j === i ? { ...g, ...patch } : g)) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit Center" : "Add Center"}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5">
          <h2 className="font-serif text-3xl font-black text-blue-900 dark:text-white">{editing ? "Edit Center" : "Add Center"}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-blue-800 hover:text-blue-950 dark:text-gray-300" aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className="mx-6 mt-4 grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-blue-100 sm:grid-cols-5 dark:border-gray-700" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold ${
                tab === t.key
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-900 dark:bg-gray-800 dark:text-white"
                  : "text-blue-900/80 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {error ? <div className="mx-6 mt-3 shrink-0 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</div> : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {tab === "basic" ? (
            <>
              <Section icon={"\u{1F3E0}"} title="Center Information">
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_260px]">
                  <Field label="Center Name" required>
                    <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Enter center name..." />
                  </Field>
                  <Field label="Center Type" required>
                    <select className={input} value={form.centerType} onChange={(e) => set({ centerType: e.target.value })}>
                      <option value="">Select center type...</option>
                      {[...new Set([...CENTER_TYPES, form.centerType].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <div className="row-span-2">
                    <span className="mb-1 block text-sm font-semibold text-blue-950 dark:text-gray-200">
                      Center Photo <span className="font-normal text-gray-500">(Optional)</span>
                    </span>
                    <label className="flex h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-center text-xs text-blue-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {form.photoUrl ? (
                        <img src={form.photoUrl} alt="Center" className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <span className="text-2xl" aria-hidden="true">{"\u{1F5BC}"}</span>
                          {uploading ? "Uploading..." : "Click to upload a photo"}
                          <span className="text-gray-500">Recommended: 800 x 600 px</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                    </label>
                    {form.photoUrl ? (
                      <button type="button" className="mt-1 text-xs font-semibold text-red-600" onClick={() => set({ photoUrl: "" })}>Remove photo</button>
                    ) : null}
                  </div>
                  <Field label="Status" required>
                    <select className={input} value={form.status} onChange={(e) => set({ status: e.target.value })}>
                      {CENTER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>
              <Section icon={"\u{1F4CD}"} title="Location Information">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Address" required className="md:col-span-3">
                    <input className={input} value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Enter street address..." />
                  </Field>
                  <Field label="City" required>
                    <input className={input} value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Enter city..." />
                  </Field>
                  <Field label="State" required>
                    <select className={input} value={form.state} onChange={(e) => set({ state: e.target.value })}>
                      <option value="">Select state...</option>
                      {[...new Set([...STATES, form.state].filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="ZIP Code" required>
                    <input className={input} value={form.zip} onChange={(e) => set({ zip: e.target.value })} placeholder="Enter ZIP code..." />
                  </Field>
                </div>
              </Section>
              <Section icon={"\u{1F465}"} title="Leadership & Contact">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Director" required>
                    <select className={input} value={form.directorId} onChange={(e) => set({ directorId: e.target.value })}>
                      <option value="">Select director...</option>
                      {directorOptions.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  </Field>
                  <Field label="Email" optional>
                    <input type="email" className={input} value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="Enter email address..." />
                  </Field>
                  <Field label="Phone" optional>
                    <input className={input} value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(000) 000-0000" />
                  </Field>
                </div>
              </Section>
              <Section icon={"\u{1F4C4}"} title="Additional Details">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Number of Classrooms" optional>
                    <input type="number" min="0" className={input} value={form.classroomCount} onChange={(e) => set({ classroomCount: e.target.value })} placeholder="Enter number..." />
                  </Field>
                  <Field label="Maximum Capacity" optional>
                    <input type="number" min="0" className={input} value={form.capacity} onChange={(e) => set({ capacity: e.target.value })} placeholder="Enter capacity..." />
                  </Field>
                  <Field label="Region" optional>
                    <input className={input} list="center-regions" value={form.region} onChange={(e) => set({ region: e.target.value })} placeholder="Select or type a region..." />
                    <datalist id="center-regions">{regions.map((r) => <option key={r} value={r} />)}</datalist>
                  </Field>
                  <Field label="Notes" optional className="md:col-span-3">
                    <textarea className={input} rows={3} maxLength={500} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Add any additional notes about this center..." />
                    <span className="mt-1 block text-right text-xs text-gray-500">{form.notes.length}/500</span>
                  </Field>
                </div>
              </Section>
            </>
          ) : null}

          {tab === "care" ? (
            <>
              <Section icon={"\u{1F4C5}"} title="Care Schedule" description="Set the days and hours of operation for this center.">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-blue-950 dark:text-gray-200">
                      <th className="py-1 font-semibold">Day</th>
                      <th className="py-1 font-semibold">Start Time</th>
                      <th className="py-1 font-semibold">End Time</th>
                      <th className="py-1 text-center font-semibold">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(({ key, label }) => {
                      const day = form.careSchedule[key] || { open: false };
                      return (
                        <tr key={key} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 text-blue-950 dark:text-gray-200">{label}</td>
                          <td className="py-1.5 pr-3">
                            <input type="time" aria-label={`${label} start`} className={input} disabled={!day.open} value={day.start || ""} onChange={(e) => updateDay(key, { start: e.target.value })} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input type="time" aria-label={`${label} end`} className={input} disabled={!day.open} value={day.end || ""} onChange={(e) => updateDay(key, { end: e.target.value })} />
                          </td>
                          <td className="py-1.5 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={day.open}
                              aria-label={`${label} open`}
                              onClick={() => updateDay(key, day.open ? { open: false } : { open: true, start: day.start || "07:30", end: day.end || "16:45" })}
                              className={`relative inline-flex h-6 w-11 rounded-full transition ${day.open ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}`}
                            >
                              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${day.open ? "left-5" : "left-0.5"}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Section>
              <Section icon={"\u{1F552}"} title="Automatic Student Checkout" description="Set the time each day when students are automatically checked out if they have not been manually checked out.">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold text-blue-950 dark:text-gray-200">Automatic Student Checkout Time</span>
                  <input type="time" aria-label="Automatic student checkout time" className={`${input} w-48`} value={form.autoCheckoutTime} onChange={(e) => set({ autoCheckoutTime: e.target.value })} />
                  <span className="text-xs text-gray-500">Shown as &quot;Admin&quot; on time sheets. Staff are never checked out automatically. Leave empty to turn off.</span>
                </div>
              </Section>
              <Section icon={"\u{1F374}"} title="Age Group Meal Configuration" description="Define which age groups are served the same foods.">
                <div className="space-y-2">
                  {form.mealAgeGroups.map((group, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-3">
                      <span className="w-28 text-sm font-semibold text-blue-950 dark:text-gray-200">Age Group {i + 1}</span>
                      <select aria-label={`Age group ${i + 1} from`} className={`${input} w-40`} value={group.fromMonths} onChange={(e) => updateAgeGroup(i, { fromMonths: Number(e.target.value) })}>
                        {AGE_CHOICES.map((m) => <option key={m} value={m}>{formatAgeMonths(m)}</option>)}
                      </select>
                      <span className="text-sm text-gray-600">to</span>
                      <select aria-label={`Age group ${i + 1} to`} className={`${input} w-40`} value={group.toMonths} onChange={(e) => updateAgeGroup(i, { toMonths: Number(e.target.value) })}>
                        {AGE_CHOICES.map((m) => <option key={m} value={m}>{formatAgeMonths(m)}</option>)}
                      </select>
                      <button type="button" className="text-red-600" aria-label={`Remove age group ${i + 1}`} onClick={() => set({ mealAgeGroups: form.mealAgeGroups.filter((_, j) => j !== i) })}>
                        &#128465;
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const last = form.mealAgeGroups[form.mealAgeGroups.length - 1];
                      const from = last ? Math.min(last.toMonths + 12, MAX_AGE_MONTHS) : 12;
                      set({ mealAgeGroups: [...form.mealAgeGroups, { fromMonths: from, toMonths: Math.min(from + 12, MAX_AGE_MONTHS) }] });
                    }}
                    className="w-full rounded-lg border border-dashed border-blue-300 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    &#8853; Add Another Age Group
                  </button>
                </div>
              </Section>
              <Section icon={"\u{1F374}"} title="Meals" description="Select which meals this center provides and indicate if each meal is catered.">
                <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-1.5 text-sm">
                  <span className="font-semibold text-blue-950 dark:text-gray-200">Meal</span>
                  <span className="font-semibold text-blue-950 dark:text-gray-200">Catered</span>
                  {MEALS.map(({ key, label }) => (
                    <div key={key} className="contents">
                      <label className="flex items-center gap-2 text-blue-900 dark:text-gray-200">
                        <input type="checkbox" checked={Boolean(form.meals[key]?.provided)} onChange={(e) => updateMeal(key, { provided: e.target.checked, catered: e.target.checked && form.meals[key]?.catered })} />
                        {label}
                      </label>
                      <label className={`flex items-center gap-2 ${form.meals[key]?.provided ? "text-blue-900 dark:text-gray-200" : "text-gray-400"}`}>
                        <input type="checkbox" disabled={!form.meals[key]?.provided} checked={Boolean(form.meals[key]?.catered)} onChange={(e) => updateMeal(key, { catered: e.target.checked })} />
                        Catered
                      </label>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">Only the meals checked here have menus for this center. Catered meals stay off the kitchen shopping list.</p>
              </Section>
            </>
          ) : null}

          {tab === "rates" ? (
            <>
              <Section
                icon={"\u{1F465}"}
                title="Age Groups and Rates"
                action={
                  <button type="button" onClick={() => set({ ageRates: [...form.ageRates, { label: "", monthly: "", weekly: "", daily: "", hourly: "" }] })} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    + Add Age Group
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-blue-950 dark:text-gray-200">
                        {["Age Group", "Monthly Rate", "Weekly Rate", "Daily Rate", "Hourly Rate", ""].map((h) => <th key={h} className="px-1 py-1 font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {form.ageRates.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-1 py-1.5">
                            <input aria-label={`Age group ${i + 1} name`} className={input} value={row.label} onChange={(e) => updateRate(i, { label: e.target.value })} placeholder="e.g. 2-Year-Olds" />
                          </td>
                          {["monthly", "weekly", "daily", "hourly"].map((field) => (
                            <td key={field} className="px-1 py-1.5">
                              <input aria-label={`${row.label || `Age group ${i + 1}`} ${field} rate`} inputMode="decimal" className={input} value={row[field]} onChange={(e) => updateRate(i, { [field]: e.target.value })} placeholder="$0.00" />
                            </td>
                          ))}
                          <td className="px-1 py-1.5 text-center">
                            <button type="button" className="text-red-600" aria-label={`Remove ${row.label || `age group ${i + 1}`}`} onClick={() => set({ ageRates: form.ageRates.filter((_, j) => j !== i) })}>&#128465;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {form.ageRates.length === 0 ? <p className="py-3 text-center text-sm text-gray-500">No age groups yet.</p> : null}
                </div>
              </Section>
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-blue-50/70 px-4 py-3 dark:bg-gray-800">
                <span className="text-base font-bold text-blue-950 dark:text-white">Initial Enrollment Fee</span>
                <input aria-label="Initial enrollment fee" inputMode="decimal" className={`${input} max-w-xs`} value={form.enrollmentFee} onChange={(e) => set({ enrollmentFee: e.target.value })} placeholder="$0.00" />
              </div>
            </>
          ) : null}

          {tab === "grade" ? (
            <StaffGradeSection weights={form.staffGradeWeights} onChange={(patch) => set({ staffGradeWeights: { ...form.staffGradeWeights, ...patch } })} />
          ) : null}

          {tab === "roles" ? (
            <Section icon={"\u{1F464}"} title="Roles" description="Select which roles can access and manage this center.">
              <div className="grid gap-3 md:grid-cols-2">
                {CENTER_ROLE_OPTIONS.map((role) => {
                  const checked = form.roleAccess.includes(role);
                  return (
                    <label key={role} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 ${checked ? "border-blue-400 bg-blue-50 dark:bg-gray-800" : "border-gray-200 dark:border-gray-700"}`}>
                      <span>
                        <span className="block text-lg font-bold text-blue-900 dark:text-white">{roleLabel(role)}</span>
                        <span className="text-sm text-blue-900/80 dark:text-gray-400">{ROLE_DESCRIPTIONS[role]}</span>
                      </span>
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5"
                        checked={checked}
                        onChange={(e) => set({ roleAccess: e.target.checked ? [...form.roleAccess, role] : form.roleAccess.filter((r) => r !== role) })}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-gray-500">Saved for a future access structure; it does not change who can use this center yet.</p>
            </Section>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
          <div>
            {tabIndex > 0 ? (
              <button type="button" onClick={() => setTab(TABS[tabIndex - 1].key)} className="rounded-lg border border-blue-800 px-6 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 dark:border-gray-500 dark:text-gray-200">
                Back
              </button>
            ) : null}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-blue-800 px-6 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 dark:border-gray-500 dark:text-gray-200">
              Cancel
            </button>
            {!isLast ? (
              <button type="button" onClick={() => setTab(TABS[tabIndex + 1].key)} className={`rounded-lg px-6 py-2.5 text-sm font-bold ${editing ? "border border-blue-800 text-blue-900 hover:bg-blue-50 dark:border-gray-500 dark:text-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                Next
              </button>
            ) : null}
            {editing || isLast ? (
              <button type="button" onClick={save} disabled={saving || uploading} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Saving..." : editing ? "Save Changes" : "Save Center"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
