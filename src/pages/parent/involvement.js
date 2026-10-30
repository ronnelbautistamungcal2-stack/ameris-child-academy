import ParentLayout from "@/components/parent/ParentLayout";
import {
  BLUE,
  ChildPicker,
  CollapsibleCard,
  EventCard,
  NAVY,
  card,
  childNames,
  control,
  dateKey,
  hoursBetween,
  label,
  shortDate,
  timeKey,
} from "@/components/involvement/InvolvementUi";
import { apiJson } from "@/lib/api";
import { INVOLVEMENT_CERTIFICATION, INVOLVEMENT_NOTES_MAX } from "@/lib/parentInvolvement";
import { useCallback, useEffect, useMemo, useState } from "react";

// Parent Involvement (client mockups 16-01..04): upcoming volunteer events
// with Sign Up, the Log Involvement form (signed with the parent's typed name)
// and My Involvement History.

const emptyEntry = () => ({ activityId: "", childIds: [], date: "", startTime: "", endTime: "", notes: "", agreed: false, signedName: "" });

export default function ParentInvolvement() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [past, setPast] = useState([]);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logOpen, setLogOpen] = useState(true);
  const [entry, setEntry] = useState(emptyEntry);
  const [saving, setSaving] = useState(false);
  const [signupFor, setSignupFor] = useState(null);

  useEffect(() => {
    Promise.all([apiJson("/api/v1/centers"), apiJson("/api/v1/children").catch(() => []), apiJson("/api/v1/parent-involvement").catch(() => [])])
      .then(([c, ch, r]) => {
        const list = Array.isArray(c) ? c : [];
        setCenters(list);
        setCenterId((current) => current || list[0]?.id || "");
        setChildren(Array.isArray(ch) ? ch : []);
        setRecords(Array.isArray(r) ? r : []);
      })
      .catch((e) => setError(e.message || "Failed to load"));
  }, []);

  const loadEvents = useCallback(async () => {
    if (!centerId) return;
    const q = `centerId=${encodeURIComponent(centerId)}`;
    try {
      const [u, p] = await Promise.all([apiJson(`/api/v1/parent-involvement/activities?${q}`), apiJson(`/api/v1/parent-involvement/activities?${q}&view=past`).catch(() => [])]);
      setUpcoming(Array.isArray(u) ? u : []);
      setPast(Array.isArray(p) ? p : []);
    } catch (e) {
      setUpcoming([]);
      setError(e.message || "Failed to load volunteer opportunities");
    }
  }, [centerId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadRecords = useCallback(() => apiJson("/api/v1/parent-involvement").then((r) => setRecords(Array.isArray(r) ? r : [])).catch(() => {}), []);
  const centerChildren = useMemo(() => children.filter((c) => !c.centerId || c.centerId === centerId), [children, centerId]);
  const activities = useMemo(() => [...(upcoming || []), ...past], [upcoming, past]);

  function pickActivity(id) {
    const a = activities.find((x) => x.id === id);
    setEntry((e) => ({ ...e, activityId: id, ...(a?.startsAt ? { date: dateKey(a.startsAt), startTime: timeKey(a.startsAt), endTime: timeKey(a.endsAt) } : {}) }));
  }

  async function logInvolvement(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiJson("/api/v1/parent-involvement", {
        method: "POST",
        body: JSON.stringify({ kind: "LOG", ...entry, signature: { agreed: entry.agreed, signedName: entry.signedName } }),
      });
      setEntry(emptyEntry());
      setSuccess("Involvement logged. Thank you!");
      loadRecords();
    } catch (err) {
      setError(err.message || "Failed to log involvement");
    } finally {
      setSaving(false);
    }
  }

  const set = (patch) => setEntry((e) => ({ ...e, ...patch }));
  const total = hoursBetween(entry.startTime, entry.endTime);
  return (
    <ParentLayout title="Parent Involvement">
      <div className="space-y-4">
        {centers.length > 1 ? (
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} max-w-xs`}>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : null}
        {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className={card}>
            <h1 className={`text-3xl font-black ${NAVY}`}>Volunteer Opportunities</h1>
            <h2 className={`mt-1 text-xl font-bold ${BLUE}`}>Upcoming Events</h2>
            <div className="mt-3 space-y-2">
              {!upcoming ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : upcoming.length ? (
                upcoming.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    action={
                      ev.signedUp ? (
                        <span className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">Signed Up</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSignupFor(ev)}
                          disabled={ev.spotsLeft === 0}
                          className="shrink-0 rounded-lg bg-[#1d4ed8] px-4 py-1.5 text-xs font-bold text-white disabled:bg-gray-300"
                          aria-label={`Sign up for ${ev.title}`}
                        >
                          {ev.spotsLeft === 0 ? "Full" : "Sign Up"}
                        </button>
                      )
                    }
                  />
                ))
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500 dark:bg-gray-800">No upcoming volunteer events right now.</div>
              )}
            </div>
          </section>

          <CollapsibleCard title="Log Involvement" open={logOpen} onToggle={() => setLogOpen((o) => !o)}>
            <form onSubmit={logInvolvement} className="space-y-3">
              <label className={label}>Activity <span className="text-red-600">*</span>
                <select value={entry.activityId} onChange={(e) => pickActivity(e.target.value)} className={`${control} mt-1`}>
                  <option value="">Select an activity</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}{a.startsAt ? ` (${shortDate(a.startsAt)})` : ""}</option>
                  ))}
                </select>
              </label>
              <div>
                <label htmlFor="log-children" className={label}>Children <span className="text-red-600">*</span></label>
                <div className="mt-1"><ChildPicker id="log-children" options={centerChildren} value={entry.childIds} onChange={(childIds) => set({ childIds })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>Date <span className="text-red-600">*</span>
                  <input type="date" value={entry.date} onChange={(e) => set({ date: e.target.value })} className={`${control} mt-1`} />
                </label>
                <label className={label}>Start Time <span className="text-red-600">*</span>
                  <input type="time" value={entry.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${control} mt-1`} />
                </label>
                <label className={label}>End Time <span className="text-red-600">*</span>
                  <input type="time" value={entry.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${control} mt-1`} />
                </label>
                <label className={label}>Total Hours
                  <input value={total.toFixed(2)} readOnly className={`${control} mt-1 bg-gray-100 dark:bg-gray-700`} />
                </label>
              </div>
              <label className={label}>Notes
                <textarea value={entry.notes} onChange={(e) => set({ notes: e.target.value.slice(0, INVOLVEMENT_NOTES_MAX) })} rows={3} placeholder="Add any additional details..." className={`${control} mt-1`} />
                <span className="block text-right text-xs font-normal text-gray-500">{entry.notes.length}/{INVOLVEMENT_NOTES_MAX}</span>
              </label>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                <label className="flex items-start gap-2 text-sm text-[#0b2a5b] dark:text-blue-100">
                  <input type="checkbox" checked={entry.agreed} onChange={(e) => set({ agreed: e.target.checked })} className="mt-0.5" />
                  {INVOLVEMENT_CERTIFICATION}
                </label>
                <label className={`${label} mt-2`}>E-Signature (type your full name) <span className="text-red-600">*</span>
                  <input value={entry.signedName} onChange={(e) => set({ signedName: e.target.value })} className={`${control} mt-1`} />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="rounded-lg bg-[#1d4ed8] px-8 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Submitting..." : "Submit"}</button>
              </div>
            </form>
          </CollapsibleCard>
        </div>

        <section className={card}>
          <h2 className={`text-2xl font-black ${NAVY}`}>My Involvement History</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-blue-50 dark:bg-gray-800">
                <tr className={`text-left font-bold ${NAVY}`}>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Children</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.length ? (
                  records.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{shortDate(r.occurredAt)}</td>
                      <td className="px-3 py-2">
                        {r.activity?.title}
                        {r.kind === "SIGNUP" ? <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">Signed up{r.roleName ? `: ${r.roleName}` : ""}</span> : null}
                      </td>
                      <td className="px-3 py-2">{childNames(r)}</td>
                      <td className="px-3 py-2">{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                      <td className="px-3 py-2">{r.notes || ""}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No involvement logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {signupFor ? (
        <SignUpDialog
          event={signupFor}
          childrenList={centerChildren}
          onClose={() => setSignupFor(null)}
          onDone={() => {
            setSignupFor(null);
            setSuccess(`You're signed up for ${signupFor.title}. Thank you!`);
            loadEvents();
            loadRecords();
          }}
        />
      ) : null}
    </ParentLayout>
  );
}

function SignUpDialog({ event, childrenList, onClose, onDone }) {
  const [form, setForm] = useState({
    roleId: "",
    childIds: childrenList.length === 1 ? [childrenList[0].id] : [],
    date: dateKey(event.startsAt),
    startTime: timeKey(event.startsAt),
    endTime: timeKey(event.endsAt),
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const roles = event.roles || [];

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/parent-involvement", { method: "POST", body: JSON.stringify({ kind: "SIGNUP", activityId: event.id, ...form }) });
      onDone();
    } catch (e) {
      setError(e.message || "Failed to sign up");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8" role="dialog" aria-modal="true" aria-label="Sign Up for Volunteer Opportunity">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className={`text-xl font-black ${NAVY}`}>Sign Up for Volunteer Opportunity</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`text-2xl ${BLUE}`}>×</button>
        </div>
        <div className="mt-3 rounded-xl bg-blue-50 p-1 dark:bg-gray-800">
          <EventCard event={event} />
        </div>
        {error ? <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-3 space-y-3">
          {roles.length ? (
            <label className={label}>Volunteer Role <span className="text-red-600">*</span>
              <select value={form.roleId} onChange={(e) => set({ roleId: e.target.value })} className={`${control} mt-1`}>
                <option value="">Select a role</option>
                {roles.map((r) => {
                  const full = r.needed && r.filled >= r.needed;
                  return (
                    <option key={r.id} value={r.id} disabled={full}>
                      {r.name}{r.needed ? ` (${Math.max(0, r.needed - r.filled)} of ${r.needed} open)` : ""}{full ? " - full" : ""}
                    </option>
                  );
                })}
              </select>
              {roles.find((r) => r.id === form.roleId)?.description ? <span className="mt-1 block text-xs font-normal text-gray-600">{roles.find((r) => r.id === form.roleId).description}</span> : null}
            </label>
          ) : null}
          <div>
            <label htmlFor="signup-children" className={label}>Child(ren) <span className="text-red-600">*</span></label>
            <div className="mt-1"><ChildPicker id="signup-children" options={childrenList} value={form.childIds} onChange={(childIds) => set({ childIds })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>Date <span className="text-red-600">*</span>
              <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={`${control} mt-1`} />
            </label>
            <label className={label}>Start Time <span className="text-red-600">*</span>
              <input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${control} mt-1`} />
            </label>
            <label className={label}>End Time <span className="text-red-600">*</span>
              <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${control} mt-1`} />
            </label>
          </div>
          <label className={label}>Total Hours
            <input value={hoursBetween(form.startTime, form.endTime).toFixed(2)} readOnly className={`${control} mt-1 bg-gray-100 dark:bg-gray-700`} />
          </label>
          <label className={label}>Notes (Optional)
            <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value.slice(0, INVOLVEMENT_NOTES_MAX) })} rows={3} placeholder="Add any additional information (optional)..." className={`${control} mt-1`} />
            <span className="block text-right text-xs font-normal text-gray-500">{form.notes.length}/{INVOLVEMENT_NOTES_MAX}</span>
          </label>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border-2 border-[#0b2a5b] px-8 py-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="rounded-lg bg-[#1d4ed8] px-8 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Signing up..." : "Sign Up"}</button>
        </div>
      </div>
    </div>
  );
}
