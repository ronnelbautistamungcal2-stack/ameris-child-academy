import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { BILLING_CYCLES, CURRICULUM_VERSIONS, PRICED_ADD_ONS, PROGRAM_TYPES, chosenDiscountId, classroomCounts, money, quote } from "@/lib/subscriptionPricing";

// Global admin > Sales & Leads (client mockup 2026-11-06). Leads come from the
// Ameris Solutions website (Request a Quote, Contact Us) or + Add Lead. The
// price comes from Settings > Subscription Pricing; Generate Quote saves it
// and gives a link to the quote page with "Complete Your Enrollment".

const STATUSES = [
  { value: "NEW", label: "New Lead", pill: "bg-blue-100 text-blue-800" },
  { value: "CONTACTED", label: "Contacted", pill: "bg-purple-100 text-purple-800" },
  { value: "QUOTE_SENT", label: "Quote Sent", pill: "bg-sky-100 text-sky-800" },
  { value: "FOLLOW_UP", label: "Follow-Up", pill: "bg-lime-100 text-lime-800" },
  { value: "PENDING_DECISION", label: "Pending Decision", pill: "bg-amber-100 text-amber-800" },
  { value: "WON", label: "Won", pill: "bg-green-100 text-green-800" },
  { value: "LOST", label: "Lost", pill: "bg-gray-200 text-gray-700" },
];
const SOURCES = { QUOTE_REQUEST: "Website quote request", CONTACT_FORM: "Website message", MANUAL: "Added by staff" };
const BEST_TIMES = ["Morning (8 AM – 12 PM)", "Afternoon (12 PM – 4 PM)", "Evening (4 PM – 6 PM)", "Any time"];

const card = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
const sectionTitle = "mb-2 text-base font-extrabold text-[#16305e] dark:text-blue-100";
const lbl = "block text-xs font-bold text-gray-700 dark:text-gray-300";

const statusOf = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];
const when = (v) => new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const day = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const dateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");

function Pill({ status }) {
  const s = statusOf(status);
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${s.pill}`}>{s.label}</span>;
}

function emptyForm() {
  return {
    centerName: "",
    contactName: "",
    email: "",
    phone: "",
    bestTime: "",
    location: "",
    about: "",
    notes: "",
    status: "NEW",
    followUpDate: "",
    locations: 1,
    addOns: [],
    children: "",
    billingCycle: "MONTHLY",
    programType: "CENTER",
    curriculumVersion: "STANDARD",
    classrooms: {},
    homeDaycareProgram: "",
    discountId: "",
  };
}

function formFrom(lead) {
  const s = lead.pricingSelection || {};
  return {
    centerName: lead.centerName || "",
    contactName: lead.contactName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    bestTime: lead.bestTime || "",
    location: lead.location || "",
    about: lead.about || "",
    notes: lead.notes || "",
    status: lead.status,
    followUpDate: dateInput(lead.followUpDate),
    locations: lead.locations ?? "",
    addOns: lead.addOns || [],
    children: s.children ?? "",
    billingCycle: s.billingCycle || "MONTHLY",
    programType: s.programType || "CENTER",
    curriculumVersion: s.curriculumVersion || "STANDARD",
    classrooms: classroomCounts(s),
    homeDaycareProgram: s.homeDaycareProgram || "",
    discountId: chosenDiscountId(s) || "",
  };
}

function bodyFrom(form) {
  return {
    centerName: form.centerName,
    contactName: form.contactName,
    email: form.email,
    phone: form.phone,
    bestTime: form.bestTime,
    location: form.location,
    about: form.about,
    notes: form.notes,
    status: form.status,
    followUpDate: form.followUpDate,
    locations: form.locations,
    addOns: form.addOns,
    pricingSelection: {
      children: form.children,
      billingCycle: form.billingCycle,
      programType: form.programType,
      curriculumVersion: form.curriculumVersion,
      classrooms: form.classrooms,
      homeDaycareProgram: form.homeDaycareProgram || null,
      discountId: form.discountId || null,
    },
  };
}

function LeadForm({ form, set, pricing }) {
  const toggleAddOn = (key) => set({ addOns: form.addOns.includes(key) ? form.addOns.filter((k) => k !== key) : [...form.addOns, key] });
  const curriculum = form.addOns.includes("CURRICULUM");
  return (
    <>
      <section className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h3 className={sectionTitle}>Customer Information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>
            Program/Center Name *
            <input className={input} value={form.centerName} onChange={(e) => set({ centerName: e.target.value })} />
          </label>
          <label className={lbl}>
            Phone Number
            <input className={input} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className={lbl}>
            Contact Name *
            <input className={input} value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </label>
          <label className={lbl}>
            Best Time to Contact
            <select className={input} value={form.bestTime} onChange={(e) => set({ bestTime: e.target.value })}>
              <option value="">—</option>
              {[...new Set([...BEST_TIMES, form.bestTime].filter(Boolean))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className={lbl}>
            Email Address *
            <input className={input} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </label>
          <label className={lbl}>
            Location (City, State)
            <input className={input} value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </label>
        </div>
        {form.about ? (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <span className="text-xs font-bold text-gray-500">From the website: </span>
            {form.about}
          </div>
        ) : null}
      </section>

      <section className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h3 className={sectionTitle}>Program &amp; Add-Ons</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className={lbl}>
              Pricing Type
              <select className={input} value={form.discountId} onChange={(e) => set({ discountId: e.target.value })}>
                <option value="">Regular (no discount)</option>
                {(pricing?.data?.discounts || [])
                  .filter((d) => d.active || d.id === form.discountId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.amount}% off)
                    </option>
                  ))}
              </select>
            </label>
            <label className={lbl}>
              Program Type
              <select className={input} value={form.programType} onChange={(e) => set({ programType: e.target.value })}>
                {PROGRAM_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Curriculum Type
              <select className={input} value={form.curriculumVersion} onChange={(e) => set({ curriculumVersion: e.target.value })}>
                {CURRICULUM_VERSIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label === "Standard" ? "Non-Denominational (Standard)" : "Non-Denominational Christian (Faith Based)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className={lbl}>Add-Ons (select all that apply)</legend>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {[...PRICED_ADD_ONS, { key: "CURRICULUM", label: "Curriculum" }].map((a) => (
                <label key={a.key} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input type="checkbox" checked={form.addOns.includes(a.key)} onChange={() => toggleAddOn(a.key)} />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {curriculum ? (
          form.programType === "HOME_DAYCARE" ? (
            <label className={`${lbl} mt-3 max-w-sm`}>
              Home Daycare Program
              <select className={input} value={form.homeDaycareProgram} onChange={(e) => set({ homeDaycareProgram: e.target.value })}>
                <option value="">Choose a program</option>
                {(pricing?.data?.homeDaycare || []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-3">
              <div className={lbl}>Curriculum – classrooms in each age group</div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                {(pricing?.data?.curriculumCenters || []).map((g) => (
                  <label key={g.key} className="flex items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-200">
                    {g.label}
                    <input
                      type="number"
                      min="0"
                      max="99"
                      aria-label={`${g.label} classrooms`}
                      className="w-14 rounded-lg border border-gray-300 bg-white px-2 py-0.5 text-right text-sm dark:border-gray-600 dark:bg-gray-800"
                      placeholder="0"
                      value={form.classrooms[g.key] || ""}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(99, Number.parseInt(e.target.value, 10) || 0));
                        const next = { ...form.classrooms };
                        if (n) next[g.key] = n;
                        else delete next[g.key];
                        set({ classrooms: next });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )
        ) : null}
      </section>

      <section className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h3 className={sectionTitle}>Program Details</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={lbl}>
            Number of Locations/Centers *
            <input className={input} type="number" min="1" value={form.locations} onChange={(e) => set({ locations: e.target.value })} />
          </label>
          <label className={lbl}>
            Total Number of Children (All Locations) *
            <input className={input} type="number" min="1" value={form.children} onChange={(e) => set({ children: e.target.value })} />
          </label>
          <label className={lbl}>
            Billing
            <select className={input} value={form.billingCycle} onChange={(e) => set({ billingCycle: e.target.value })}>
              {BILLING_CYCLES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </>
  );
}

function PriceLines({ q }) {
  if (!q) return <p className="text-sm text-gray-500">Enter the number of children to see the price.</p>;
  if (q.error) return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{q.error}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {[...q.lines, ...q.discounts].map((l, i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-1 text-gray-800 dark:text-gray-200">{l.label}</td>
            <td className="py-1 text-right text-xs text-gray-500">{l.detail || ""}</td>
            <td className={`py-1 text-right font-semibold ${l.amount < 0 ? "text-green-700" : "text-gray-900 dark:text-gray-100"}`}>{money(l.amount)}</td>
          </tr>
        ))}
        <tr>
          <td className="pt-2 font-extrabold text-gray-900 dark:text-gray-100">Monthly</td>
          <td />
          <td className="pt-2 text-right font-extrabold text-gray-900 dark:text-gray-100">{money(q.monthly)}</td>
        </tr>
        {q.periodTotal !== q.monthly ? (
          <tr>
            <td className="font-bold text-gray-900 dark:text-gray-100">Annual (12 months)</td>
            <td />
            <td className="text-right font-bold text-gray-900 dark:text-gray-100">{money(q.periodTotal)}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function AddLeadDialog({ pricing, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add Lead">
      <div className={`${card} flex max-h-[92vh] w-full max-w-3xl flex-col`}>
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Add Lead</h2>
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LeadForm form={form} set={set} pricing={pricing} />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
          {error ? <span className="mr-auto text-sm text-red-700">{error}</span> : null}
          <button
            type="button"
            className={primary}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                onCreated(await apiJson("/api/v1/global/leads", { method: "POST", body: JSON.stringify(bodyFrom(form)) }));
              } catch (e) {
                setError(e.message || "Could not add the lead");
                setSaving(false);
              }
            }}
          >
            {saving ? "Adding..." : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ id, pricing, onChanged }) {
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const receive = useCallback((l) => {
    setLead(l);
    setForm(formFrom(l));
    setDirty(false);
  }, []);
  useEffect(() => {
    setLead(null);
    setError("");
    setNotice("");
    apiJson(`/api/v1/global/leads/${id}`)
      .then(receive)
      .catch((e) => setError(e.message || "Could not load the lead"));
  }, [id, receive]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setNotice("");
  };
  const preview = useMemo(() => {
    if (!pricing || !form || form.children === "") return null;
    return quote(pricing.data, { ...bodyFrom(form).pricingSelection, children: Number(form.children), addOns: form.addOns });
  }, [pricing, form]);

  async function call(method, body, message) {
    setSaving(true);
    setError("");
    try {
      receive(await apiJson(`/api/v1/global/leads/${id}`, { method, body: JSON.stringify(body) }));
      if (message) setNotice(message);
      onChanged();
      return true;
    } catch (e) {
      setError(e.message || "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (!lead || !form) return <div className={`${card} p-6`}>{error || "Loading..."}</div>;
  const quoteUrl = lead.quoteToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/solutions/quote/${lead.quoteToken}` : "";

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
        <div>
          <div className="text-xs font-semibold text-gray-500">
            {lead.number} · {SOURCES[lead.source] || lead.source} · {when(lead.createdAt)}
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Lead Details</h2>
        </div>
        <div className="flex items-center gap-2">
          <select className={`${input} w-44`} aria-label="Lead status" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" className={primary} disabled={!dirty || saving} onClick={() => call("PATCH", bodyFrom(form), "Saved.")}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      {error ? <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mx-4 mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}

      <LeadForm form={form} set={set} pricing={pricing} />

      <section className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h3 className={sectionTitle}>Quote Information</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-bold text-gray-500">Price with the current pricing{dirty ? " (unsaved changes)" : ""}</div>
            <PriceLines q={preview} />
          </div>
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="font-bold text-gray-600 dark:text-gray-300">Quote #</dt>
              <dd>{lead.quoteNumber || "Not generated yet"}</dd>
              <dt className="font-bold text-gray-600 dark:text-gray-300">Quote Status</dt>
              <dd>{lead.quoteStatus ? lead.quoteStatus.charAt(0) + lead.quoteStatus.slice(1).toLowerCase() : "Draft"}</dd>
              <dt className="font-bold text-gray-600 dark:text-gray-300">Quote Date</dt>
              <dd>{lead.quoteDate ? day(lead.quoteDate) : "—"}</dd>
              <dt className="font-bold text-gray-600 dark:text-gray-300">Expiration Date</dt>
              <dd>{day(lead.quoteExpiresAt)}</dd>
              {lead.quoteData ? (
                <>
                  <dt className="font-bold text-gray-600 dark:text-gray-300">Quoted Monthly</dt>
                  <dd className="font-bold">{money(lead.quoteData.monthly)}</dd>
                </>
              ) : null}
            </dl>
            <label className={`${lbl} max-w-xs`}>
              Follow-Up Date
              <input className={input} type="date" value={form.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primary}
                disabled={saving || !preview || preview.error}
                title={dirty ? "Saves your changes, then generates the quote" : ""}
                onClick={async () => {
                  if (dirty && !(await call("PATCH", bodyFrom(form)))) return;
                  await call("POST", { generateQuote: true }, "Quote generated. Copy the link and send it to the customer.");
                }}
              >
                {lead.quoteNumber ? "Regenerate Quote" : "Generate Quote"}
              </button>
              {quoteUrl ? (
                <>
                  <a className={button} href={`/solutions/quote/${lead.quoteToken}`} target="_blank" rel="noreferrer">
                    Open Quote
                  </a>
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      navigator.clipboard?.writeText(quoteUrl).then(() => setNotice("Quote link copied."), () => setNotice(quoteUrl));
                    }}
                  >
                    Copy Quote Link
                  </button>
                </>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Emailing quotes comes once an email service is set up; until then, copy the link into your email.</p>
          </div>
        </div>
        <label className={`${lbl} mt-4`}>
          Notes
          <textarea className={`${input} min-h-[70px]`} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </section>

      <section className="p-4">
        <h3 className={sectionTitle}>Activity History</h3>
        <form
          className="mb-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("POST", { note })) setNote("");
          }}
        >
          <input className={input} placeholder="Add an activity (e.g. Called, left a message)..." value={note} onChange={(e) => setNote(e.target.value)} aria-label="New activity" />
          <button type="submit" className={button} disabled={!note.trim() || saving}>
            Add
          </button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-bold text-gray-500">
            <tr>
              <th className="py-1">Date &amp; Time</th>
              <th className="py-1">Staff</th>
              <th className="py-1">Activity</th>
            </tr>
          </thead>
          <tbody>
            {lead.activities.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 align-top dark:border-gray-800">
                <td className="whitespace-nowrap py-1.5 pr-3">{when(a.createdAt)}</td>
                <td className="whitespace-nowrap py-1.5 pr-3">{a.staff?.name || a.staff?.email || "Website"}</td>
                <td className="py-1.5">{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function GlobalLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState(null);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("");
  const [pricing, setPricing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiJson(`/api/v1/global/leads?${new URLSearchParams({ status, q })}`);
      setLeads(data.leads);
      setCounts(data.counts || {});
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the leads");
    }
  }, [status, q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    apiJson("/api/v1/global/pricing-sets")
      .then(({ sets }) => setPricing(sets.find((s) => s.current) || null))
      .catch(() => setPricing(null));
  }, []);
  useEffect(() => {
    if (router.isReady && router.query.lead) setSelected(String(router.query.lead));
  }, [router.isReady, router.query.lead]);
  useEffect(() => {
    if (!selected && leads?.length) setSelected(leads[0].id);
  }, [leads, selected]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <GlobalLayout title="Sales & Leads">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Sales &amp; Leads</h1>
        <button type="button" className={primary} onClick={() => setAdding(true)}>
          + Add Lead
        </button>
      </div>
      {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,320px)_1fr]">
        <div className={`${card} h-fit p-3`}>
          <select className={input} aria-label="Lead status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses ({total})</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({counts[s.value] || 0})
              </option>
            ))}
          </select>
          <input className={`${input} mt-2`} placeholder="Search name, contact or email..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {(leads || []).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelected(l.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left ${selected === l.id ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">{l.centerName}</span>
                    <span className="block truncate text-xs text-gray-500">{l.contactName}</span>
                  </span>
                  <Pill status={l.status} />
                </button>
              </li>
            ))}
            {leads && !leads.length ? <li className="py-6 text-center text-sm text-gray-500">No leads yet.</li> : null}
          </ul>
        </div>
        <div>{selected ? <Detail key={selected} id={selected} pricing={pricing} onChanged={load} /> : <div className={`${card} p-6 text-sm text-gray-500`}>Select a lead.</div>}</div>
      </div>
      {adding ? (
        <AddLeadDialog
          pricing={pricing}
          onClose={() => setAdding(false)}
          onCreated={(lead) => {
            setAdding(false);
            setSelected(lead.id);
            load();
          }}
        />
      ) : null}
    </GlobalLayout>
  );
}
