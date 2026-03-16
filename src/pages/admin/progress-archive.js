import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function currentSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function ProgressArchive() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [archives, setArchives] = useState([]);

  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setChildren([]);
      setArchives([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [kids, arch] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/progress/archive?centerId=${encodeURIComponent(centerId)}&schoolYear=${encodeURIComponent(schoolYear)}`),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setArchives(Array.isArray(arch) ? arch : []);
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, schoolYear]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function refreshArchives() {
    try {
      const arch = await apiJson(`/api/v1/progress/archive?centerId=${encodeURIComponent(centerId)}&schoolYear=${encodeURIComponent(schoolYear)}`);
      setArchives(Array.isArray(arch) ? arch : []);
    } catch {
      // silent
    }
  }

  async function createArchive(selectedChildId) {
    setArchiving(true);
    setError("");
    setSuccess("");
    try {
      const body = { centerId, schoolYear };
      if (selectedChildId) body.childId = selectedChildId;
      await apiJson("/api/v1/progress/archive", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(selectedChildId ? "Child progress archived successfully." : "All children archived successfully.");
      await refreshArchives();
    } catch (e) {
      setError(e.message || "Failed to archive");
    } finally {
      setArchiving(false);
    }
  }

  async function downloadArchive(archiveId, format) {
    try {
      const archive = await apiJson(`/api/v1/progress/archive/${encodeURIComponent(archiveId)}`);
      if (!archive?.data) throw new Error("No data in archive");

      let content, mimeType, ext;
      if (format === "csv") {
        const records = archive.data.progressRecords || [];
        const rows = [["Lesson", "Category", "Goal Index", "Goal Title", "Status", "Achieved At", "Notes"]];
        for (const r of records) {
          rows.push([
            r.lesson?.title || "",
            r.lesson?.category || "",
            String(r.goalIndex || ""),
            r.goalTitle || "",
            r.status || "",
            r.achievedAt || "",
            r.entries?.[0]?.notes || "",
          ]);
        }
        content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        mimeType = "text/csv";
        ext = "csv";
      } else {
        content = JSON.stringify(archive.data, null, 2);
        mimeType = "application/json";
        ext = "json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `progress-${archive.childName?.replace(/\s+/g, "-") || "archive"}-${archive.schoolYear}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Failed to download");
    }
  }

  async function deleteArchive(id) {
    try {
      await apiJson(`/api/v1/progress/archive/${encodeURIComponent(id)}`, { method: "DELETE" });
      setDeleteTarget(null);
      await refreshArchives();
    } catch (e) {
      setError(e.message || "Failed to delete");
      setDeleteTarget(null);
    }
  }

  const schoolYearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) {
      years.push(`${y - 1}-${y}`);
    }
    return years;
  }, []);

  const selectedCenter = centers.find(c => c.id === centerId);

  return (
    <AdminLayout title="Progress Archive">
      {/* Stats */}
      {!loading && centerId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon={<ArchiveIcon color="#2563eb" />} label="Archived Records" value={archives.length} color="#2563eb" bg="#DBEAFE" />
          <StatCard icon={<ChildIcon color="#059669" />} label="Children in Center" value={children.length} color="#059669" bg="#D1FAE5" />
          <StatCard icon={<CalendarIcon color="#D97706" />} label="School Year" value={schoolYear} color="#D97706" bg="#FEF3C7" isText />
        </div>
      )}

      {/* Filters Panel */}
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArchiveIcon color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Progress Archive</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 2, fontSize: 13, margin: "2px 0 0 0" }}>
              Archive and export progress data across school years for record-keeping and transfers.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}

        {/* Filter Controls */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label style={{ display: "block" }}>
            <div style={fieldLabelStyle}>Center *</div>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={loading} style={inputStyle}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <div style={fieldLabelStyle}>School Year</div>
            <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} style={inputStyle}>
              {schoolYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <div style={fieldLabelStyle}>Child (optional)</div>
            <select value={childId} onChange={(e) => setChildId(e.target.value)} disabled={!centerId} style={{ ...inputStyle, opacity: centerId ? 1 : 0.5 }}>
              <option value="">All children</option>
              {children.map((ch) => <option key={ch.id} value={ch.id}>{ch.firstName} {ch.lastName || ""}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!centerId || archiving}
            onClick={() => createArchive(childId || null)}
            style={{ ...primaryBtnStyle, opacity: !centerId || archiving ? 0.6 : 1, cursor: !centerId || archiving ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
          >
            <ArchiveIcon color="white" size={14} />
            {archiving ? "Archiving..." : childId ? "Archive Child" : "Archive All"}
          </button>
        </div>

        {/* Center Info Pill */}
        {selectedCenter && (
          <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: 12, fontWeight: 600, color: "#1E40AF" }}>
            <CenterPinIcon />
            {selectedCenter.name}
            {selectedCenter.address && <span style={{ color: "#60A5FA" }}>&middot; {selectedCenter.address}</span>}
          </div>
        )}
      </div>

      {/* Quick Export */}
      {centerId && children.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DownloadIcon color="#7C3AED" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--admin-text)" }}>Quick Export</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--admin-text-muted)" }}>Download current progress data without archiving.</p>
            </div>
          </div>

          {childId ? (
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`/api/v1/progress/export?childId=${encodeURIComponent(childId)}&format=json`}
                download
                style={exportBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#EFF6FF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
              >
                <JsonIcon /> JSON
              </a>
              <a
                href={`/api/v1/progress/export?childId=${encodeURIComponent(childId)}&format=csv`}
                download
                style={exportBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#86EFAC"; e.currentTarget.style.background = "#F0FDF4"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
              >
                <CsvIcon /> CSV
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 12, fontWeight: 600, color: "#92400E" }}>
              <InfoIcon color="#D97706" />
              Select a specific child above to export their data.
            </div>
          )}
        </div>
      )}

      {/* Archives List */}
      {centerId && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--admin-text)" }}>Archived Records</h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "#DBEAFE", color: "#1E40AF", border: "1px solid #93C5FD" }}>
                {schoolYear}
              </span>
            </div>
            {archives.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)" }}>
                {archives.length} record{archives.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : archives.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                <ArchiveIcon color="#9CA3AF" size={24} />
              </div>
              <p style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>No archives yet</p>
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>Use the filters above to archive progress data for this school year.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {archives.map((a) => {
                const initials = (a.childName || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <div
                    key={a.id}
                    style={cardStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: 700, fontSize: 15, flexShrink: 0,
                      letterSpacing: "0.02em",
                    }}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>{a.childName}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          background: "#DBEAFE", color: "#1E40AF", border: "1px solid #93C5FD",
                          letterSpacing: "0.03em",
                        }}>
                          {a.schoolYear}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <CalendarIcon color="#9CA3AF" size={12} />
                        Archived {formatDate(a.archivedAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" style={cardActionBtn} onClick={() => downloadArchive(a.id, "json")}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#EFF6FF"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
                      >
                        <DownloadIcon color="#2563EB" size={13} /> JSON
                      </button>
                      <button type="button" style={cardActionBtn} onClick={() => downloadArchive(a.id, "csv")}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#86EFAC"; e.currentTarget.style.background = "#F0FDF4"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
                      >
                        <DownloadIcon color="#059669" size={13} /> CSV
                      </button>
                      <button type="button" style={cardDangerBtn} onClick={() => setDeleteTarget(a.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Archive"
        message="Are you sure you want to delete this archive? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteArchive(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value, color, bg, isText }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>{icon}</div>
      <div>
        <div style={{ fontSize: isText ? 16 : 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, marginTop: 12, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      {message}
    </div>
  );
}

function SuccessBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "#D1FAE5", color: "#065F46", borderRadius: 10, marginTop: 12, border: "1px solid #A7F3D0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      {message}
    </div>
  );
}

/* ── Icons ── */

function ArchiveIcon({ color = "currentColor", size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
}

function ChildIcon({ color = "currentColor" }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}

function CalendarIcon({ color = "currentColor", size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}

function DownloadIcon({ color = "currentColor", size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

function CenterPinIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}

function InfoIcon({ color = "currentColor" }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}

function JsonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
}

function CsvIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}

/* ── Styles ── */

const panelStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 20,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 13,
};

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const cardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 16,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const cardActionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
  transition: "border-color 0.15s, background 0.15s",
  textDecoration: "none",
};

const cardDangerBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 7,
  border: "1px solid #FECACA",
  borderRadius: 8,
  background: "#FEF2F2",
  color: "#DC2626",
  cursor: "pointer",
};

const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 18px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const exportBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
  transition: "border-color 0.15s, background 0.15s",
};
