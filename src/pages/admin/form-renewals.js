import AdminLayout from "@/components/admin/AdminLayout";
import FormLibraryPanel from "@/components/admin/FormLibraryPanel";
import { Modal } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

// Admin Form Renewals (client mockups 36-02/03): each child's renewing forms
// with expiration, days until due, status and a note; Add Form puts a new
// form on the parents' Forms & Renewals page; a sent form opens with its
// e-signature. The Form Library tab manages every form template (family,
// child, age group, staff).

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const PAGE = 15;
const STATUS = {
  OVERDUE: ["Overdue", "bg-red-500", "text-red-600"],
  DUE_SOON: ["Due Soon", "bg-amber-400", "text-amber-700"],
  CURRENT: ["Current", "bg-blue-500", "text-blue-700"],
};
const FORM_TYPES = [
  "Immunization Record",
  "Physical Exam",
  "Emergency Contact Form",
  "Medication Authorization",
  "Allergy Action Plan",
  "Enrollment Agreement",
  "Health Assessment",
];
const FREQUENCIES = [
  { days: 30, label: "Every month" },
  { days: 91, label: "Every 3 months" },
  { days: 182, label: "Every 6 months" },
  { days: 365, label: "Every year" },
  { days: 730, label: "Every 2 years" },
];
const RANGES = [
  { value: "", label: "All Dates" },
  { value: "PAST", label: "Past due" },
  { value: "30", label: "Next 30 days" },
  { value: "90", label: "Next 90 days" },
];
const fmt = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not sent");

export default function FormRenewals() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [data, setData] = useState(null);
  const [formType, setFormType] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState("");
  const [view, setView] = useState("renewals");
  const [success, setSuccess] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await apiJson(`/api/v1/forms/renewals/tracker${centerId ? `?centerId=${encodeURIComponent(centerId)}` : ""}`));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load form renewals");
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [formType, status, range, centerId]);

  const rows = useMemo(
    () =>
      (data?.rows || []).filter((r) => {
        if (formType && r.templateId !== formType) return false;
        if (status && r.status !== status) return false;
        if (range === "PAST" && !(r.daysUntilDue < 0)) return false;
        if (range && range !== "PAST" && !(r.daysUntilDue !== null && r.daysUntilDue >= 0 && r.daysUntilDue <= Number(range))) return false;
        return true;
      }),
    [data, formType, status, range],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  async function saveNote(row, note) {
    try {
      await apiJson("/api/v1/forms/renewals/tracker", { method: "PUT", body: JSON.stringify({ templateId: row.templateId, childId: row.childId, note }) });
      setData((d) => ({ ...d, rows: d.rows.map((r) => (r.key === row.key ? { ...r, note } : r)) }));
    } catch (e) {
      setError(e.message || "Failed to save the note");
    }
  }

  const tiles = data?.tiles || {};
  return (
    <AdminLayout title="Form Renewals">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className={`text-3xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>Form Renewals</h1>
          <div className="flex flex-wrap items-end gap-3">
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-56`}>
              <option value="">All Centers</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {view === "renewals" ? (
              <button type="button" onClick={() => setAdding(true)} className="rounded-lg bg-[#0b2a5b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#123a7a]">+ Add Form</button>
            ) : null}
          </div>
        </div>
        <div className="flex gap-6 border-b border-gray-200 text-sm font-semibold dark:border-gray-700">
          {[
            ["renewals", "Renewals"],
            ["library", "Form Library"],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setView(key);
                setError("");
                setSuccess("");
              }}
              aria-pressed={view === key}
              className={`-mb-px border-b-2 pb-2 ${view === key ? "border-[#0b2a5b] text-[#0b2a5b] dark:border-blue-200 dark:text-blue-100" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"}`}
            >
              {text}
            </button>
          ))}
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div> : null}

        {view === "library" ? (
          <FormLibraryPanel onError={setError} onSuccess={setSuccess} />
        ) : (
        <>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["!", tiles.overdue, "Overdue", "bg-red-50", "OVERDUE"],
            ["🕒", tiles.dueSoon, "Due Soon (within 30 days)", "bg-amber-50", "DUE_SOON"],
            ["📄", tiles.current, "Current", "bg-blue-50", "CURRENT"],
            ["👥", tiles.total, "Total Forms Tracked", "bg-violet-50", ""],
          ].map(([icon, value, label, tone, key]) => (
            <button key={label} type="button" onClick={() => setStatus(key)} className={`flex items-center gap-3 rounded-xl p-4 text-left ${tone} dark:bg-gray-800`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-[#0b2a5b] shadow-sm" aria-hidden="true">{icon}</span>
              <span>
                <span className={`block text-2xl font-black ${NAVY}`}>{value ?? "—"}</span>
                <span className="text-sm text-[#0b2a5b] dark:text-blue-100">{label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-sm font-bold">
            Form Type
            <select value={formType} onChange={(e) => setFormType(e.target.value)} className={`${control} mt-1`}>
              <option value="">All Form Types</option>
              {(data?.formTypes || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${control} mt-1`}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Due Date Range
            <select value={range} onChange={(e) => setRange(e.target.value)} className={`${control} mt-1`}>
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setFormType(""); setStatus(""); setRange(""); }} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700">Clear Filters</button>
        </div>

        <h2 className={`text-2xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>Form Renewals</h2>
        {!data ? (
          <Skeleton count={8} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <tr>{["Parent", "Child", "Form Type", "Current Expiration Date", "Days Until Due", "Status", "Notes", ""].map((h) => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {shown.map((r) => {
                  const [label, dot, text] = STATUS[r.status];
                  return (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-[#0b2a5b] dark:text-blue-100">{r.parent || "—"}</td>
                      <td className="px-3 py-2 text-[#0b2a5b] dark:text-blue-100">{r.child}</td>
                      <td className="px-3 py-2 text-[#0b2a5b] dark:text-blue-100">{r.formType}</td>
                      <td className="px-3 py-2">{fmt(r.expiration)}</td>
                      <td className="px-3 py-2">{r.daysUntilDue === null ? "—" : `${r.daysUntilDue} days`}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${text}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
                          {label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          defaultValue={r.note}
                          key={`${r.key}-${r.note}`}
                          onBlur={(e) => e.target.value !== r.note && saveNote(r, e.target.value)}
                          aria-label={`Note for ${r.child} ${r.formType}`}
                          className="w-48 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {r.submissionId ? (
                          <button type="button" onClick={() => setViewing(r.submissionId)} className="text-xs font-semibold text-blue-700 underline">View</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">{data.rows.length ? "No forms match these filters." : "No renewing forms yet. Use Add Form to add one."}</td></tr>
                ) : null}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-gray-600">
              <span>Showing {rows.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(rows.length, page * PAGE)} of {rows.length} items</span>
              <span className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-gray-300 px-2 disabled:opacity-40" aria-label="Previous page">‹</button>
                <span className="rounded bg-blue-600 px-2 font-bold text-white">{page}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border border-gray-300 px-2 disabled:opacity-40" aria-label="Next page">›</button>
              </span>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {adding ? (
        <AddFormDialog
          centerId={centerId}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      ) : null}
      {viewing ? <SignedFormDialog submissionId={viewing} onClose={() => setViewing("")} /> : null}
    </AdminLayout>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddFormDialog({ centerId, onClose, onSaved }) {
  const [form, setForm] = useState({ type: "", otherType: "", days: "", attachment: null });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Files must be 10 MB or smaller.");
    if (!/\.(pdf|docx?|jpe?g|png)$/i.test(file.name)) return setError("Accepted formats: PDF, DOC, DOCX, JPG, PNG.");
    setUploading(true);
    setError("");
    try {
      const saved = await apiJson("/api/v1/uploads", { method: "POST", body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) }) });
      setForm((f) => ({ ...f, attachment: { url: saved.url, name: file.name, size: file.size } }));
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const title = form.type === "OTHER" ? form.otherType.trim() : form.type;
    if (!title) return setError("Select a form type.");
    if (!form.days) return setError("Select how often it expires.");
    if (!form.attachment) return setError("Upload the form.");
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/forms/templates", {
        method: "POST",
        body: JSON.stringify({
          title,
          targetRole: "PARENT",
          assignmentType: "CHILD",
          active: true,
          requiresRenewal: true,
          renewalPeriodDays: Number(form.days),
          centerId: centerId || null,
          attachmentUrl: form.attachment.url,
          attachmentName: form.attachment.name,
          attachmentSize: form.attachment.size,
        }),
      });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the form");
      setSaving(false);
    }
  }

  const label = "block text-sm font-bold text-[#0b2a5b] dark:text-blue-100";
  return (
    <Modal
      title="📄 Add Form"
      label="Add Form"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-300 px-6 py-2 text-sm font-bold text-[#0b2a5b]">Cancel</button>
          <button type="button" onClick={save} disabled={saving || uploading} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Form"}</button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className={label}>
          Form Type <span className="text-red-500">*</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`${control} mt-1`}>
            <option value="">Select a form type</option>
            {FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="OTHER">Other…</option>
          </select>
        </label>
        {form.type === "OTHER" ? (
          <label className={label}>Form name<input value={form.otherType} onChange={(e) => setForm({ ...form, otherType: e.target.value })} className={`${control} mt-1`} /></label>
        ) : null}
        <label className={label}>
          How often it expires? <span className="text-red-500">*</span>
          <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={`${control} mt-1`}>
            <option value="">Select frequency</option>
            {FREQUENCIES.map((f) => <option key={f.days} value={f.days}>{f.label}</option>)}
          </select>
        </label>
        <div>
          <div className={label}>Upload Attachment <span className="text-red-500">*</span></div>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files?.[0]);
            }}
            className="mt-1 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-blue-200 px-4 py-6 text-center text-sm"
          >
            <span className="text-2xl text-blue-600" aria-hidden="true">☁</span>
            <span className="font-bold text-blue-800">{uploading ? "Uploading..." : form.attachment ? form.attachment.name : "Drag and drop a file here"}</span>
            <span className="text-gray-600">or click to upload</span>
            <span className="text-xs text-gray-500">Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10 MB)</span>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
        <p className="text-xs text-gray-500">The form appears on every family&apos;s Forms &amp; Renewals page{centerId ? " at this center" : ""}.</p>
      </div>
    </Modal>
  );
}

function SignedFormDialog({ submissionId, onClose }) {
  const [sub, setSub] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiJson(`/api/v1/forms/submissions/${submissionId}`)
      .then(setSub)
      .catch((e) => setError(e.message || "Failed to load the form"));
  }, [submissionId]);
  const data = sub?.data && typeof sub.data === "object" ? sub.data : {};
  const answers = Object.entries(data).filter(([key]) => !["certification", "document", "notes"].includes(key));
  return (
    <Modal
      title={sub?.template?.title || "Form"}
      label="Submitted form"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700">🖨 Print</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold">Close</button>
        </>
      }
    >
      {error ? <p className="text-sm text-red-600">{error}</p> : !sub ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="space-y-3 text-sm">
          <p>
            <b>Child:</b> {[sub.child?.firstName, sub.child?.lastName].filter(Boolean).join(" ") || "—"} &nbsp;·&nbsp; <b>Sent by:</b> {sub.submittedBy?.name || sub.submittedBy?.email} on {new Date(sub.createdAt).toLocaleString()}
          </p>
          {answers.length ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {answers.map(([key, value]) => (
                <div key={key} className="rounded border border-gray-200 px-3 py-2">
                  <dt className="text-xs font-bold text-gray-500">{key}</dt>
                  <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {data.notes ? <p><b>Notes:</b> {data.notes}</p> : null}
          {data.document?.url ? <a href={data.document.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">View the attached document</a> : null}
          {data.certification ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="italic">{data.certification.statement}</p>
              <p className="mt-2"><b>E-signature:</b> <span className="font-serif text-lg italic">{data.certification.signedName}</span></p>
              <p><b>Date signed:</b> {new Date(data.certification.signedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-gray-500">This form was sent before e-signatures were required.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
