import ParentLayout from "@/components/parent/ParentLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { INVOLVEMENT_NOTES_MAX } from "@/lib/parentInvolvement";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const NAVY = "text-[#0f2d57] dark:text-gray-100";
const CONTROL =
  "w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm text-gray-800 shadow-sm focus:border-[#1a6fd6] focus:outline-none focus:ring-2 focus:ring-[#1a6fd6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
// Stretch the browser's own picker button invisibly over the field, so the
// left-hand icon is the only one shown and a click anywhere opens the picker.
const DATE_PICKER =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";
const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-600 dark:text-gray-400";

// Quarter-hour slots across the center's day.
const TIME_OPTIONS = (() => {
  const out = [];
  for (let m = 6 * 60; m <= 21 * 60; m += 15) {
    const value = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    out.push({ value, label: formatClock(value) });
  }
  return out;
})();

function formatClock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d) {
  const mins = Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
  return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
}

function formatShortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

function formatTime(d) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function emptyEntry(date = "") {
  return { childIds: [], date, startTime: "", endTime: "", notes: "" };
}

function entryError(entry) {
  if (!entry.childIds.length) return "Please select at least one child.";
  if (!entry.date) return "Please choose a date.";
  if (!entry.startTime || !entry.endTime) return "Please choose a start and end time.";
  if (hoursBetween(entry.startTime, entry.endTime) <= 0) return "End time must be after the start time.";
  return "";
}

function childNames(record, allChildren) {
  const list = record.children?.length ? record.children : record.child ? [record.child] : [];
  if (!list.length) return "—";
  if (allChildren.length > 1 && list.length === allChildren.length) return "All Children";
  return list.map((c) => c.firstName).join(", ");
}

export default function ParentInvolvement() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [activities, setActivities] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activityId, setActivityId] = useState("");
  const [entry, setEntry] = useState(emptyEntry());
  const [signupFor, setSignupFor] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, ch, r] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/children").catch(() => []),
          apiJson("/api/v1/parent-involvement").catch(() => []),
        ]);
        const centerArr = Array.isArray(c) ? c : [];
        setCenters(centerArr);
        if (centerArr.length) setCenterId(centerArr[0].id);
        setChildren(Array.isArray(ch) ? ch : []);
        setRecords(Array.isArray(r) ? r : []);
      } catch (e) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadActivities = useCallback(async () => {
    if (!centerId) { setActivities([]); return; }
    try {
      const data = await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}`);
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      setActivities([]);
    }
  }, [centerId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const loadRecords = useCallback(async () => {
    try {
      const data = await apiJson("/api/v1/parent-involvement");
      setRecords(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const centerChildren = useMemo(
    () => children.filter((c) => !centerId || !c.centerId || c.centerId === centerId),
    [children, centerId],
  );

  const submit = async (kind, targetActivityId, values) => {
    await apiJson("/api/v1/parent-involvement", {
      method: "POST",
      body: JSON.stringify({ kind, activityId: targetActivityId, ...values }),
    });
    await Promise.all([loadRecords(), loadActivities()]);
  };

  const handleLog = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const problem = !activityId ? "Please select an activity." : entryError(entry);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      await submit("LOG", activityId, entry);
      setSuccess("Involvement logged. Thank you!");
      setActivityId("");
      setEntry(emptyEntry());
    } catch (err) {
      setError(err.message || "Failed to log involvement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ParentLayout title="Parent Involvement">
      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="space-y-4">
          {centers.length > 1 ? (
            <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Center
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${CONTROL} max-w-xs px-3`}>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card title="Volunteer Opportunities">
              {activities.length === 0 ? (
                <EmptyNote>No volunteer opportunities have been posted yet. Please check back soon.</EmptyNote>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#eef1f5] dark:bg-gray-900/60">
                        <th scope="col" className={TH}>Opportunity</th>
                        <th scope="col" className={TH}>Date/Time</th>
                        <th scope="col" className={`${TH} whitespace-nowrap text-center`}>Spots Left</th>
                        <th scope="col" className={TH}><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {activities.map((a) => (
                        <OpportunityRow key={a.id} activity={a} onSignUp={() => setSignupFor(a)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Log Involvement">
              <form onSubmit={handleLog} className="space-y-4" noValidate>
                {error ? <Banner tone="error">{error}</Banner> : null}
                {success ? <Banner tone="success">{success}</Banner> : null}

                <Field label="Activity" required>
                  <SelectShell>
                    <select
                      value={activityId}
                      onChange={(e) => setActivityId(e.target.value)}
                      className={`${CONTROL} appearance-none pl-3.5 pr-9 ${activityId ? "" : "text-gray-500"}`}
                    >
                      <option value="">Select an activity</option>
                      {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  </SelectShell>
                </Field>

                <Field label="Children" required>
                  <ChildPicker
                    options={centerChildren}
                    value={entry.childIds}
                    onChange={(childIds) => setEntry({ ...entry, childIds })}
                  />
                </Field>

                <TimeFields entry={entry} onChange={setEntry} />
                <NotesField value={entry.notes} onChange={(notes) => setEntry({ ...entry, notes })} />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-w-[134px] rounded-lg bg-[#0f2d57] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b2244] disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Submit"}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          <Card title="My Involvement History">
            {records.length === 0 ? (
              <EmptyNote>No involvement has been logged yet. Sign up for an opportunity or log your time above.</EmptyNote>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#eef1f5] dark:bg-gray-900/60">
                      <th scope="col" className={TH}>Date</th>
                      <th scope="col" className={TH}>Activity</th>
                      <th scope="col" className={TH}>Children</th>
                      <th scope="col" className={TH}>Hours</th>
                      <th scope="col" className={TH}>Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-800 dark:text-gray-300">{formatShortDate(r.occurredAt)}</td>
                        <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">
                          {r.activity?.title}
                          {r.kind === "SIGNUP" && new Date(r.occurredAt) >= new Date(new Date().setHours(0, 0, 0, 0)) ? (
                            <span className="ml-2 rounded-full bg-[#e8f1fc] px-2 py-0.5 text-[11px] font-semibold text-[#1a6fd6] dark:bg-sky-950/60 dark:text-sky-300">
                              Signed up
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 dark:text-gray-300">{childNames(r, children)}</td>
                        <td className="px-3 py-2.5 text-gray-800 dark:text-gray-300">
                          {typeof r.hours === "number" ? r.hours.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-400">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {signupFor ? (
        <SignUpDialog
          activity={signupFor}
          childOptions={centerChildren}
          onClose={() => setSignupFor(null)}
          onSubmit={async (values) => {
            await submit("SIGNUP", signupFor.id, values);
            setSignupFor(null);
            setError("");
            setSuccess(`You're signed up for ${signupFor.title}. Thank you!`);
          }}
        />
      ) : null}
    </ParentLayout>
  );
}

function OpportunityRow({ activity, onSignUp }) {
  const start = activity.startsAt ? new Date(activity.startsAt) : null;
  const end = activity.endsAt ? new Date(activity.endsAt) : null;
  const full = activity.spotsLeft === 0;

  let action = (
    <button
      type="button"
      onClick={onSignUp}
      className="w-[84px] rounded-md bg-[#0b5cc4] py-1.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#094ea8]"
    >
      Sign Up
    </button>
  );
  if (activity.signedUp) {
    action = (
      <span className="inline-flex w-[84px] justify-center rounded-md border border-[#0b5cc4] py-1.5 text-[13px] font-medium text-[#0b5cc4] dark:border-sky-400 dark:text-sky-300">
        Signed Up
      </span>
    );
  } else if (full) {
    action = (
      <span className="inline-flex w-[84px] justify-center rounded-md bg-gray-200 py-1.5 text-[13px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        Full
      </span>
    );
  }

  return (
    <tr>
      <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">{activity.title}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300">
        {start ? (
          <>
            <div>{start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            {end ? <div>{formatTime(start)} - {formatTime(end)}</div> : <div>{formatTime(start)}</div>}
          </>
        ) : (
          activity.schedule || "Ongoing"
        )}
      </td>
      <td className="px-3 py-2.5 text-center text-gray-800 dark:text-gray-200">
        {activity.spotsLeft == null ? "—" : activity.spotsLeft}
      </td>
      <td className="px-3 py-2 text-right">{action}</td>
    </tr>
  );
}

function SignUpDialog({ activity, childOptions, onClose, onSubmit }) {
  const [entry, setEntry] = useState(() => {
    const start = activity.startsAt ? new Date(activity.startsAt) : null;
    const end = activity.endsAt ? new Date(activity.endsAt) : null;
    return {
      ...emptyEntry(toDateInput(start || new Date())),
      startTime: start ? toTimeInput(start) : "",
      endTime: end ? toTimeInput(end) : "",
    };
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = entryError(entry);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError("");
    try {
      await onSubmit(entry);
    } catch (err) {
      setError(err.message || "Could not sign up");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f2d57]/40 p-4 sm:p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 w-full max-w-[560px] rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="signup-title" className={`text-lg font-extrabold tracking-tight ${NAVY}`}>
            Sign Up for Volunteer Opportunity
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg bg-[#e8f1fc] px-4 py-3 dark:bg-sky-950/50">
            <div className={`text-[15px] font-bold ${NAVY}`}>{activity.title}</div>
            {activity.description ? (
              <div className="mt-0.5 text-[13px] text-gray-700 dark:text-gray-300">{activity.description}</div>
            ) : null}
          </div>

          {error ? <Banner tone="error">{error}</Banner> : null}

          <TimeFields entry={entry} onChange={setEntry} />
          <Field label="Children" required>
            <ChildPicker
              options={childOptions}
              value={entry.childIds}
              onChange={(childIds) => setEntry({ ...entry, childIds })}
            />
          </Field>
          <NotesField
            value={entry.notes}
            onChange={(notes) => setEntry({ ...entry, notes })}
            placeholder="Add any additional information (optional)"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[110px] rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#0b5cc4] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-sky-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-w-[110px] rounded-lg bg-[#0f2d57] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0b2244] disabled:opacity-60"
          >
            {saving ? "Signing up…" : "Sign Up"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TimeFields({ entry, onChange }) {
  const hours = hoursBetween(entry.startTime, entry.endTime);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Date" required>
        <IconShell icon={<CalendarIcon />}>
          <input
            type="date"
            value={entry.date}
            onChange={(e) => onChange({ ...entry, date: e.target.value })}
            className={`${CONTROL} ${DATE_PICKER} relative pl-10 pr-3 ${entry.date ? "" : "text-gray-500"}`}
          />
        </IconShell>
      </Field>
      <Field label="Start Time" required>
        <TimeSelect value={entry.startTime} onChange={(startTime) => onChange({ ...entry, startTime })} />
      </Field>
      <Field label="End Time" required>
        <TimeSelect value={entry.endTime} onChange={(endTime) => onChange({ ...entry, endTime })} />
      </Field>
      <Field label="Total Hours">
        <input
          readOnly
          tabIndex={-1}
          value={hours.toFixed(2)}
          className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400"
        />
      </Field>
    </div>
  );
}

function TimeSelect({ value, onChange }) {
  const options = value && !TIME_OPTIONS.some((o) => o.value === value)
    ? [...TIME_OPTIONS, { value, label: formatClock(value) }].sort((a, b) => a.value.localeCompare(b.value))
    : TIME_OPTIONS;
  return (
    <IconShell icon={<ClockIcon />}>
      <SelectShell>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${CONTROL} appearance-none pl-10 pr-9 ${value ? "" : "text-gray-500"}`}
        >
          <option value="">Select time</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </SelectShell>
    </IconShell>
  );
}

function ChildPicker({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const selected = options.filter((c) => value.includes(c.id));
  const allSelected = options.length > 1 && selected.length === options.length;
  const label = !selected.length
    ? "Select child(ren)"
    : allSelected
      ? "All Children"
      : selected.map((c) => c.firstName).join(", ");

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${CONTROL} flex items-center justify-between pl-3.5 pr-3 text-left`}
      >
        <span className={`truncate ${selected.length ? "" : "text-gray-500"}`}>{label}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable="true" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-sm text-gray-500">No children are linked to your account.</div>
          ) : (
            <>
              {options.length > 1 ? (
                <PickerOption
                  checked={allSelected}
                  onChange={() => onChange(allSelected ? [] : options.map((c) => c.id))}
                  label="All Children"
                  bold
                />
              ) : null}
              {options.map((c) => (
                <PickerOption
                  key={c.id}
                  checked={value.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  label={`${c.firstName} ${c.lastName || ""}`.trim()}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PickerOption({ checked, onChange, label, bold }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-gray-800 hover:bg-[#f4f6f9] dark:text-gray-200 dark:hover:bg-gray-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-[#0b5cc4]" />
      <span className={bold ? "font-semibold" : ""}>{label}</span>
    </label>
  );
}

function NotesField({ value, onChange, placeholder }) {
  return (
    <Field label="Notes">
      <div className="relative">
        <textarea
          value={value}
          maxLength={INVOLVEMENT_NOTES_MAX}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={`${CONTROL} resize-none px-3.5 pb-6`}
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500">
          {value.length}/{INVOLVEMENT_NOTES_MAX}
        </span>
      </div>
    </Field>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <h2 className={`mb-4 text-[22px] font-black tracking-tight ${NAVY}`}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.04em] text-gray-700 dark:text-gray-300">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function IconShell({ icon, children }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-600 dark:text-gray-400">{icon}</span>
      {children}
    </div>
  );
}

function SelectShell({ children }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><ChevronIcon /></span>
    </div>
  );
}

function Banner({ tone, children }) {
  const cls = tone === "error"
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-200";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

function EmptyNote({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-[#f4f6f9] px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
      {children}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6v4l2.5 1.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3M7 12l1.5 1.5L12 10" />
    </svg>
  );
}
