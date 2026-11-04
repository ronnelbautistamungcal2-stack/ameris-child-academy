import { NAVY, card } from "@/components/reports/reportUi";
import { apiJson } from "@/lib/api";
import { downloadBlob, zipFiles } from "@/lib/zipFiles";
import { useEffect, useState } from "react";

// Photos section under the Student Activity Log (client request 2026-10-29):
// every Daily Log photo of the child for a date range, pick several and
// download them together as one .zip.

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

export default function ChildPhotos({ childId, childName = "child" }) {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [photos, setPhotos] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!childId) return;
    setPhotos(null);
    setSelected([]);
    apiJson(`/api/v1/children/${encodeURIComponent(childId)}/photos?from=${range.from}&to=${range.to}`)
      .then((rows) => setPhotos(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        setPhotos([]);
        setError(e.message || "Could not load the photos");
      });
  }, [childId, range]);

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allSelected = photos?.length > 0 && selected.length === photos.length;

  async function download() {
    const picked = (photos || []).filter((p) => selected.includes(p.id));
    if (!picked.length) return;
    setBusy(true);
    setError("");
    try {
      const files = [];
      for (const [i, photo] of picked.entries()) {
        const res = await fetch(photo.url);
        if (!res.ok) continue;
        const ext = (photo.url.match(/\.[a-z0-9]{2,5}$/i) || [".jpg"])[0];
        const day = new Date(photo.date).toISOString().slice(0, 10);
        files.push({ name: `${day}-${String(i + 1).padStart(3, "0")}${ext}`, data: new Uint8Array(await res.arrayBuffer()) });
      }
      if (!files.length) throw new Error("The photos could not be downloaded");
      const safeName = String(childName).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "child";
      downloadBlob(zipFiles(files), `${safeName}-photos-${range.from}-to-${range.to}.zip`);
    } catch (e) {
      setError(e.message || "The download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className={`text-lg font-black ${NAVY}`}>
          <span aria-hidden>📷</span> Photos
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
            Start Date
            <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={`${control} mt-1 block`} />
          </label>
          <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
            End Date
            <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={`${control} mt-1 block`} />
          </label>
        </div>
      </div>
      {error ? <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {!photos ? (
        <p className="mt-3 text-sm text-gray-500">Loading photos...</p>
      ) : !photos.length ? (
        <p className="mt-3 text-sm text-gray-500">No photos in these dates.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelected(allSelected ? [] : photos.map((p) => p.id))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold dark:border-gray-600">
              {allSelected ? "Clear Selection" : "Select All"}
            </button>
            <button type="button" onClick={download} disabled={!selected.length || busy} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Preparing..." : `Download${selected.length ? ` (${selected.length})` : ""}`}
            </button>
            <span className="text-xs text-gray-500">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => {
              const on = selected.includes(p.id);
              return (
                <li key={p.id} className={`relative overflow-hidden rounded-xl border-2 ${on ? "border-blue-600" : "border-transparent"}`}>
                  <a href={p.url} target="_blank" rel="noreferrer" title="Open photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo from ${new Date(p.date).toLocaleDateString()}`} loading="lazy" className="aspect-square w-full object-cover" />
                  </a>
                  <label className="absolute left-1.5 top-1.5 flex items-center rounded bg-white/90 p-1 shadow">
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} aria-label={`Select photo from ${new Date(p.date).toLocaleDateString()}`} className="h-4 w-4" />
                  </label>
                  <div className="bg-white/90 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-900/90 dark:text-gray-300">{new Date(p.date).toLocaleDateString()}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
