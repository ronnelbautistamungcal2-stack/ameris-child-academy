import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

// Global admin > Settings > General (client mockup 2026-11-06): company
// information, email and notification settings, automated notices, email
// templates and the subscriber agreement (EULA) versions. Emails are saved
// now and sent once an email service is connected.

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-lg border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
const h2 = "mb-3 text-base font-extrabold text-[#16305e] dark:text-blue-100";
const row = "grid grid-cols-[150px_1fr] items-center gap-2 text-sm";
const day = (v) => (v ? new Date(`${v}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");

const COMPANY = [
  ["name", "Company Name *"],
  ["dba", "DBA"],
  ["email", "Email *"],
  ["phone", "Phone *"],
  ["website", "Website"],
];
const EMAIL = [
  ["fromName", "From Name"],
  ["fromEmail", "From Email"],
  ["replyTo", "Reply-To Email"],
];
const AUTOMATED = [
  ["paymentReminderDaysBefore", "Payment Reminder", "Days Before Due"],
  ["pastDueDaysAfter", "Past Due Notice", "Days After Due"],
  ["suspensionDaysAfter", "Suspension Notice", "Days After Due"],
  ["renewalReminderDaysBefore", "Renewal Reminder", "Days Before Renewal"],
];

function TemplateDialog({ template, onClose, onSaved }) {
  const [form, setForm] = useState({ name: template.name, subject: template.subject, body: template.body, active: template.active });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Email Template">
      <div className={`${card} flex max-h-[92vh] w-full max-w-5xl flex-col`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-[#0b2a5b] dark:text-blue-100">Email Template</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Edit the template for {template.name}.</p>
          </div>
          <button type="button" className={button} onClick={onClose} disabled={saving} aria-label="Close">
            ×
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
              Template Name *
              <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
              Subject Line *
              <input className={input} value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
            </label>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
              Body *
              <textarea className={`${input} min-h-[260px]`} value={form.body} onChange={(e) => set({ body: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
              Active
              <span className="text-xs font-normal text-gray-500">Inactive templates will not be used when sending automated emails.</span>
            </label>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Preview</div>
            <div className="rounded-lg bg-white p-4 text-sm text-gray-800 shadow-sm">
              <p className="mb-3 border-b border-gray-200 pb-2 font-bold">{form.subject}</p>
              <div className="whitespace-pre-wrap">{form.body}</div>
            </div>
          </div>
        </div>
        {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={primary}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                onSaved(await apiJson(`/api/v1/global/email-templates/${template.id}`, { method: "PUT", body: JSON.stringify(form) }));
              } catch (e) {
                setError(e.message || "Could not save");
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadAgreementDialog({ onClose, onUploaded }) {
  const [form, setForm] = useState({ name: "Ameris Solutions Subscriber Agreement", version: "", effectiveDate: "", file: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Upload New Agreement">
      <form
        className={`${card} w-full max-w-md space-y-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.file) return setError("Choose the agreement file (PDF)");
          setSaving(true);
          setError("");
          try {
            const dataBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(form.file);
            });
            const up = await apiJson("/api/v1/uploads", { method: "POST", body: JSON.stringify({ filename: form.file.name, mimeType: form.file.type, dataBase64 }) });
            const out = await apiJson("/api/v1/global/settings", {
              method: "POST",
              body: JSON.stringify({ agreement: { name: form.name, version: form.version, effectiveDate: form.effectiveDate, fileUrl: up.url } }),
            });
            onUploaded(out.agreements);
          } catch (err) {
            setError(err.message || "Could not upload");
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Upload New Agreement</h2>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          Agreement Name
          <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Version
            <input className={input} placeholder="e.g. v2.0" value={form.version} onChange={(e) => set({ version: e.target.value })} required />
          </label>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Effective Date
            <input className={input} type="date" value={form.effectiveDate} onChange={(e) => set({ effectiveDate: e.target.value })} required />
          </label>
        </div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          File (PDF)
          <input className={input} type="file" accept="application/pdf,.pdf,.doc,.docx" onChange={(e) => set({ file: e.target.files?.[0] || null })} />
        </label>
        <p className="text-xs text-gray-500">The new agreement becomes the current one. Earlier versions stay in the history.</p>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function GeneralSettings() {
  const [data, setData] = useState(null);
  const [general, setGeneral] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiJson("/api/v1/global/settings");
      setData(d);
      setGeneral(d.general);
      setDirty(false);
    } catch (e) {
      setError(e.message || "Could not load the settings");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (group, patch) => {
    setGeneral((g) => ({ ...g, [group]: { ...g[group], ...patch } }));
    setDirty(true);
    setNotice("");
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const out = await apiJson("/api/v1/global/settings", { method: "PUT", body: JSON.stringify({ general }) });
      setGeneral(out.general);
      setDirty(false);
      setNotice("Settings saved.");
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function chooseCurrent(id) {
    setError("");
    try {
      const out = await apiJson("/api/v1/global/settings", { method: "PATCH", body: JSON.stringify({ currentAgreementId: id }) });
      setData((d) => ({ ...d, agreements: out.agreements }));
      setNotice("Current agreement changed.");
    } catch (e) {
      setError(e.message || "Could not change the agreement");
    }
  }

  if (!data || !general) return <div className={card}>{error || "Loading..."}</div>;
  const current = data.agreements.find((a) => a.current);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-3">
        {error ? <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">{error}</span> : null}
        {notice ? <span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-800">{notice}</span> : null}
        <button type="button" className={primary} onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className={h2}>Company Information</h2>
          <div className="space-y-2">
            {COMPANY.map(([k, label]) => (
              <label key={k} className={row}>
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <input className={input} value={general.company[k]} onChange={(e) => set("company", { [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className={h2}>Notification Settings</h2>
          <div className="space-y-2">
            {Object.entries(data.notificationLabels).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={general.notifications[k]} onChange={(e) => set("notifications", { [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">In-app notifications today; emails once an email service is connected.</p>
        </section>

        <section className={card}>
          <h2 className={h2}>Email Settings</h2>
          <div className="space-y-2">
            {EMAIL.map(([k, label]) => (
              <label key={k} className={row}>
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <input className={input} value={general.email[k]} onChange={(e) => set("email", { [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className={h2}>Automated Notifications</h2>
          <div className="space-y-2">
            {AUTOMATED.map(([k, label, unit]) => (
              <label key={k} className="grid grid-cols-[150px_80px_1fr] items-center gap-2 text-sm">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <input className={`${input} text-right`} type="number" min="0" max="365" value={general.automated[k]} onChange={(e) => set("automated", { [k]: e.target.value })} />
                <span className="text-gray-600 dark:text-gray-300">{unit}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Used for billing notices once online payment is connected.</p>
        </section>

        <section className={card}>
          <h2 className={h2}>Email Templates</h2>
          <table className="w-full text-sm">
            <thead className="text-xs font-bold text-gray-600 dark:text-gray-300">
              <tr>
                <th className="py-1 text-left">Template Name</th>
                <th className="py-1 text-left">Status</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {data.templates.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5">{t.name}</td>
                  <td className="py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" className={button} onClick={() => setEditing(t)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={card}>
          <h2 className={h2}>Subscriber Agreement (EULA)</h2>
          <label className={row}>
            <span className="font-bold text-gray-700 dark:text-gray-200">Current Agreement</span>
            <select className={input} value={current?.id || ""} onChange={(e) => e.target.value && chooseCurrent(e.target.value)} disabled={!data.agreements.length}>
              {!data.agreements.length ? <option value="">None uploaded yet</option> : null}
              {data.agreements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.version})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => setUploading(true)}>
              Upload New Agreement
            </button>
            {current ? (
              <a className={button} href={current.fileUrl} target="_blank" rel="noreferrer">
                View Agreement
              </a>
            ) : null}
          </div>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <h2 className={h2}>Agreement History</h2>
          <table className="w-full text-sm">
            <thead className="text-xs font-bold text-gray-600 dark:text-gray-300">
              <tr>
                <th className="py-1 text-left">Agreement Name</th>
                <th className="py-1 text-left">Effective Date</th>
                <th className="py-1 text-left">Status</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {data.agreements.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5">
                    {a.name} ({a.version})
                  </td>
                  <td className="py-1.5">{day(a.effectiveDate)}</td>
                  <td className="py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.current ? "bg-green-100 text-green-800" : "bg-gray-500 text-white"}`}>
                      {a.current ? "Current" : "Previous"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    <a className={button} href={a.fileUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </td>
                </tr>
              ))}
              {!data.agreements.length ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No agreements uploaded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
      {editing ? (
        <TemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setEditing(null);
            setData((d) => ({ ...d, templates: d.templates.map((x) => (x.id === t.id ? t : x)) }));
            setNotice(`${t.name} saved.`);
          }}
        />
      ) : null}
      {uploading ? (
        <UploadAgreementDialog
          onClose={() => setUploading(false)}
          onUploaded={(agreements) => {
            setUploading(false);
            setData((d) => ({ ...d, agreements }));
            setNotice("Agreement uploaded and set as current.");
          }}
        />
      ) : null}
    </div>
  );
}
