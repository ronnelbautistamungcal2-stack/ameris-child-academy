import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

// Daily Log photos (client sheet 10-29 (11), row 22): every photo on the
// center's Daily Log entries, by classroom and start/end date. Click one to
// open it, tick the ones to download, or download them all as a .zip.

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const control = "rounded-lg border px-3 py-2 text-sm";
const controlStyle = { borderColor: "var(--admin-border)", background: "var(--admin-bg)", color: "var(--admin-text)" };

export default function DailyLogPhotos({ centerId, classrooms = [] }) {
  const [classRoomId, setClassRoomId] = useState("");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: dayKey(from), to: dayKey(to) };
  });
  const [photos, setPhotos] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState([]);

  const query = useMemo(() => new URLSearchParams({ centerId: centerId || "", ...(classRoomId ? { classRoomId } : {}), from: range.from, to: range.to }), [centerId, classRoomId, range]);

  useEffect(() => {
    if (!centerId) return;
    setPhotos(null);
    setPicked([]);
    setError("");
    apiJson(`/api/v1/activities/photos?${query}`)
      .then((d) => setPhotos(d.photos))
      .catch((e) => setError(e.message || "Could not load the photos"));
  }, [centerId, query]);

  if (!centerId) return null;
  const zipHref = (urls) => `/api/v1/activities/photos?${query}&download=zip${urls ? `&only=${encodeURIComponent(urls.join(","))}` : ""}`;
  const toggle = (url) => setPicked((p) => (p.includes(url) ? p.filter((u) => u !== url) : [...p, url]));
  const roomsHere = classrooms.filter((c) => !c.centerId || c.centerId === centerId);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Photos{photos ? ` (${photos.length})` : ""}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <select aria-label="Photos classroom" value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} className={control} style={controlStyle}>
            <option value="">All classrooms</option>
            {roomsHere.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-secondary)" }}>
            Start Date
            <input type="date" aria-label="Photos start date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={`${control} block`} style={controlStyle} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-secondary)" }}>
            End Date
            <input type="date" aria-label="Photos end date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={`${control} block`} style={controlStyle} />
          </label>
          {picked.length ? (
            <a href={zipHref(picked)} className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
              ⬇ Download Selected ({picked.length})
            </a>
          ) : null}
          {photos?.length ? (
            <a href={zipHref(null)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
              ⬇ Download All
            </a>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!photos && !error ? <p className="text-sm text-gray-500">Loading photos...</p> : null}
      {photos && !photos.length ? <p className="text-sm text-gray-500">No photos on the Daily Log for these dates.</p> : null}
      {photos?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {photos.map((p) => (
            <figure key={`${p.url}-${p.at}`} style={{ margin: 0, border: "1px solid var(--admin-border)", borderRadius: 10, overflow: "hidden", background: "var(--admin-bg-secondary)" }}>
              <a href={p.url} target="_blank" rel="noreferrer" title="Open photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${p.childName} on ${new Date(p.at).toLocaleDateString()}`} loading="lazy" style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
              </a>
              <figcaption style={{ padding: "6px 8px", fontSize: 12, color: "var(--admin-text)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  <input type="checkbox" checked={picked.includes(p.url)} onChange={() => toggle(p.url)} aria-label={`Select photo of ${p.childName}`} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.childName}</span>
                </label>
                <div style={{ color: "var(--admin-text-muted)" }}>
                  {new Date(p.at).toLocaleDateString()}
                  {p.classroom ? ` · ${p.classroom}` : ""}
                </div>
                <a href={p.url} download style={{ color: "#1d4ed8", fontWeight: 600 }}>
                  Download
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
