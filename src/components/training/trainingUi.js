import { apiJson } from "@/lib/api";
import { MATERIAL_KINDS, PROGRESS_STATUSES } from "@/lib/training";
import { useState } from "react";

// Shared bits of the training pages (client mockups 41-Training).

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";
export const control = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
export const card = "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";

const CATEGORY_TONES = {
  Onboarding: "bg-blue-100 text-blue-800",
  Classroom: "bg-violet-100 text-violet-800",
  Compliance: "bg-red-100 text-red-700",
  Leadership: "bg-amber-100 text-amber-800",
  "Professional Growth": "bg-emerald-100 text-emerald-800",
};

export function CategoryPill({ value }) {
  if (!value) return <span className="text-gray-400">—</span>;
  return <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${CATEGORY_TONES[value] || "bg-gray-100 text-gray-700"}`}>{value}</span>;
}

export function StatusPill({ status }) {
  const meta = PROGRESS_STATUSES.find((s) => s.value === status) || PROGRESS_STATUSES[0];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold ${meta.pill}`}>{meta.label}</span>;
}

export function ActivePill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ProgressBar({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
    </div>
  );
}

export const fmtDate = (v) => (v ? new Date(String(v).length === 10 ? `${v}T00:00:00` : v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

/** A multi-select shown as removable chips with a dropdown to add more. */
export function ChipSelect({ value, onChange, options, placeholder, label }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const remaining = opts.filter((o) => !value.includes(o.value));
  return (
    <div>
      <select
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={control}
        aria-label={label}
      >
        <option value="">{value.length ? "Add another..." : placeholder}</option>
        {remaining.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {value.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-gray-800 dark:text-blue-200">
              {opts.find((o) => o.value === v)?.label || v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="text-blue-600">×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Training Materials: attachments (uploaded), links and videos. */
export function MaterialsEditor({ value, onChange }) {
  const [adding, setAdding] = useState(null); // LINK | VIDEO
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) }),
      });
      onChange([...value, { kind: "ATTACHMENT", name: file.name, url: saved.url }]);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function addLink() {
    if (!url.trim()) return;
    onChange([...value, { kind: adding, name: name.trim() || (adding === "VIDEO" ? "Video" : "Link"), url: url.trim() }]);
    setAdding(null);
    setUrl("");
    setName("");
  }

  const tile = "flex items-center gap-3 rounded-xl border border-blue-200 px-4 py-3 text-left hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-gray-800";
  return (
    <div>
      <div className={`text-sm font-bold ${NAVY}`}>Training Materials</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className={`${tile} cursor-pointer`}>
          <span className="text-xl" aria-hidden>📎</span>
          <span>
            <span className="block text-sm font-bold text-blue-800 dark:text-blue-200">{busy ? "Uploading..." : "Add Attachment"}</span>
            <span className="block text-xs text-gray-500">PDF, DOC, PPT, etc.</span>
          </span>
          <input type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
        </label>
        <button type="button" onClick={() => setAdding("LINK")} className={tile}>
          <span className="text-xl" aria-hidden>🔗</span>
          <span>
            <span className="block text-sm font-bold text-blue-800 dark:text-blue-200">Add Link</span>
            <span className="block text-xs text-gray-500">External website link</span>
          </span>
        </button>
        <button type="button" onClick={() => setAdding("VIDEO")} className={tile}>
          <span className="text-xl" aria-hidden>🎬</span>
          <span>
            <span className="block text-sm font-bold text-blue-800 dark:text-blue-200">Add Video</span>
            <span className="block text-xs text-gray-500">YouTube or video link</span>
          </span>
        </button>
      </div>
      {adding ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-blue-50 p-3 dark:bg-gray-800">
          <label className="flex-1 text-xs font-semibold">
            {adding === "VIDEO" ? "Video link" : "Link"}
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={control} />
          </label>
          <label className="flex-1 text-xs font-semibold">
            Name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} className={control} />
          </label>
          <button type="button" onClick={addLink} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">Add</button>
          <button type="button" onClick={() => setAdding(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {value.length ? (
        <ul className="mt-2 space-y-1">
          {value.map((m, i) => (
            <li key={`${m.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700">
              <span className="truncate">
                <span className="mr-2 text-xs font-bold text-gray-500">{MATERIAL_KINDS.find((k) => k.value === m.kind)?.label}</span>
                {m.name}
              </span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false, label }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8" role="dialog" aria-modal="true" aria-label={label || title}>
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} rounded-2xl bg-white shadow-2xl dark:bg-gray-900`}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className={`text-2xl font-black ${NAVY}`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">{footer}</div> : null}
      </div>
    </div>
  );
}

export const PAGE_SIZE = 10;

/** "Showing 1 - 10 of 24 ..." with previous / next pages (mockup tables). */
export function Pager({ page, total, noun, onPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(total, page * PAGE_SIZE);
  const btn = "flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-300 px-2 text-sm disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
      <span>Showing {first} - {last} of {total} {noun}</span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-600 px-2 font-bold text-white">{page}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
      </span>
    </div>
  );
}

export const pageRows = (rows, page) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

export function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function Avatar({ name }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{initials(name)}</span>;
}

export const thead = "bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100";
