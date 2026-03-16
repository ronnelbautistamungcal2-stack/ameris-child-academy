import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState, useCallback } from "react";

function schoolYearOptions() {
  const now = new Date();
  const y = now.getFullYear();
  const opts = [];
  for (let i = y - 3; i <= y + 1; i++) opts.push(`${i}-${i + 1}`);
  return opts;
}

const ARCHIVE_TYPE_META = {
  FULL_RECORD: { label: "Full Record", color: "info", icon: "folder" },
  PROGRESS: { label: "Progress Only", color: "accent", icon: "chart" },
};

export default function DataArchivePage() {
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [centerId, setCenterId] = useState("");
  const [schoolYear, setSchoolYear] = useState(schoolYearOptions()[3] || "");
  const [childId, setChildId] = useState("");
  const [archiveType, setArchiveType] = useState("FULL_RECORD");

  // Search & filter for archive list
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  // Expanded detail view
  const [expandedId, setExpandedId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((c) => {
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!centerId) {
      setChildren([]);
      setArchives([]);
      return;
    }
    apiJson(`/api/v1/children?centerId=${centerId}`)
      .then((c) => setChildren(Array.isArray(c) ? c : []))
      .catch(() => {});
    loadArchives();
  }, [centerId, schoolYear]);

  async function loadArchives() {
    if (!centerId) return;
    setArchiveLoading(true);
    try {
      const q = new URLSearchParams({ centerId });
      if (schoolYear) q.set("schoolYear", schoolYear);
      const data = await apiJson(`/api/v1/data-archive?${q}`);
      setArchives(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setArchiveLoading(false);
    }
  }

  async function createArchive() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiJson("/api/v1/data-archive", {
        method: "POST",
        body: JSON.stringify({ centerId, schoolYear, childId: childId || null, archiveType }),
      });
      setSuccess("Archive created successfully.");
      await loadArchives();
    } catch (e) {
      setError(e.message || "Failed to create archive");
    } finally {
      setLoading(false);
    }
  }

  async function downloadArchive(archiveId, format) {
    setDownloadingId(archiveId);
    try {
      const archive = await apiJson(`/api/v1/data-archive/${encodeURIComponent(archiveId)}`);
      let content, mimeType, ext;
      if (format === "csv") {
        const records = archive.data?.progressRecords || [];
        const rows = [["Lesson", "Category", "Goal", "Status", "Achieved At"]];
        for (const pr of records) {
          rows.push([
            pr.lesson?.title || "",
            pr.lesson?.category || "",
            String(pr.goalIndex),
            pr.status,
            pr.achievedAt || "",
          ]);
        }
        content = rows
          .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
          .join("\n");
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
      a.download = `archive-${archive.childName?.replace(/\s+/g, "-") || "data"}-${archive.schoolYear}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Failed to download");
    } finally {
      setDownloadingId("");
    }
  }

  async function deleteArchive(archiveId) {
    if (!confirm("Delete this archive permanently? This cannot be undone.")) return;
    try {
      await apiJson(`/api/v1/data-archive/${encodeURIComponent(archiveId)}`, {
        method: "DELETE",
      });
      setSuccess("Archive deleted.");
      if (expandedId === archiveId) setExpandedId("");
      await loadArchives();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  // Filter archives
  const filteredArchives = useMemo(() => {
    let result = archives;
    if (filterType) result = result.filter((a) => a.archiveType === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.childName?.toLowerCase().includes(q) ||
          a.schoolYear?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [archives, filterType, search]);

  // Stats
  const stats = useMemo(() => {
    const full = archives.filter((a) => a.archiveType === "FULL_RECORD").length;
    const progress = archives.filter((a) => a.archiveType === "PROGRESS").length;
    const uniqueChildren = new Set(archives.map((a) => a.childId)).size;
    return { total: archives.length, full, progress, uniqueChildren };
  }, [archives]);

  const selectedCenter = centers.find((c) => c.id === centerId);

  return (
    <AdminLayout title="Data Archive">
      {/* ── Page Header ── */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div style={{ flex: 1 }}>
            <div style={styles.headerTitleRow}>
              <div style={styles.headerIcon}>
                <SvgArchive size={22} />
              </div>
              <div>
                <h1 style={styles.pageTitle}>Data Archive</h1>
                <p style={styles.pageDesc}>
                  Create comprehensive archives of child records — progress, activities, attendance,
                  forms, and behavior plans. Download as JSON or CSV.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={styles.alertError}>
            <SvgAlertCircle size={16} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError("")} style={styles.alertClose}>&times;</button>
          </div>
        )}
        {success && (
          <div style={styles.alertSuccess}>
            <SvgCheckCircle size={16} />
            <span style={{ flex: 1 }}>{success}</span>
            <button onClick={() => setSuccess("")} style={styles.alertClose}>&times;</button>
          </div>
        )}

        {/* Create Archive Form */}
        <div style={styles.formGrid}>
          <Field label="Center" required>
            <div style={styles.selectWrapper}>
              <SvgBuilding size={16} />
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                style={styles.selectWithIcon}
              >
                <option value="">Select center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="School Year" required>
            <div style={styles.selectWrapper}>
              <SvgCalendar size={16} />
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                style={styles.selectWithIcon}
              >
                {schoolYearOptions().map((sy) => (
                  <option key={sy} value={sy}>
                    {sy}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Child" hint="optional">
            <div style={styles.selectWrapper}>
              <SvgUser size={16} />
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                style={styles.selectWithIcon}
                disabled={!centerId}
              >
                <option value="">All children</option>
                {children
                  .slice()
                  .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName || ""}
                    </option>
                  ))}
              </select>
            </div>
          </Field>

          <Field label="Archive Type">
            <div style={styles.typeToggle}>
              {[
                { value: "FULL_RECORD", label: "Full Record", icon: <SvgFolder size={14} /> },
                { value: "PROGRESS", label: "Progress Only", icon: <SvgChart size={14} /> },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setArchiveType(opt.value)}
                  style={
                    archiveType === opt.value
                      ? styles.typeToggleActive
                      : styles.typeToggleInactive
                  }
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={createArchive}
            disabled={!centerId || loading}
            style={{
              ...styles.primaryBtn,
              opacity: !centerId || loading ? 0.5 : 1,
              cursor: !centerId || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <>
                <SvgSpinner size={14} /> Creating Archive...
              </>
            ) : (
              <>
                <SvgPlus size={14} /> Create Archive
              </>
            )}
          </button>
          {!centerId && (
            <span style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>
              Select a center to get started
            </span>
          )}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {centerId && archives.length > 0 && (
        <div style={styles.statsRow}>
          <StatCard
            label="Total Archives"
            value={stats.total}
            icon={<SvgArchive size={18} />}
            color="var(--admin-info-text)"
            bg="var(--admin-info-bg)"
          />
          <StatCard
            label="Full Records"
            value={stats.full}
            icon={<SvgFolder size={18} />}
            color="var(--admin-accent-text)"
            bg="var(--admin-accent-bg)"
          />
          <StatCard
            label="Progress Only"
            value={stats.progress}
            icon={<SvgChart size={18} />}
            color="var(--admin-success-text)"
            bg="var(--admin-success-bg)"
          />
          <StatCard
            label="Children Archived"
            value={stats.uniqueChildren}
            icon={<SvgUser size={18} />}
            color="var(--admin-warning-text)"
            bg="var(--admin-warning-bg)"
          />
        </div>
      )}

      {/* ── Archive List ── */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <h3 style={styles.listTitle}>
            <SvgArchive size={18} />
            Archives
            {archives.length > 0 && (
              <span style={styles.countBadge}>{archives.length}</span>
            )}
          </h3>

          {archives.length > 0 && (
            <div style={styles.listToolbar}>
              {/* Search */}
              <div style={styles.searchWrapper}>
                <SvgSearch size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by child name..."
                  style={styles.searchInput}
                />
              </div>

              {/* Type filter */}
              <div style={styles.filterChips}>
                <button
                  type="button"
                  onClick={() => setFilterType("")}
                  style={!filterType ? styles.chipActive : styles.chip}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType(filterType === "FULL_RECORD" ? "" : "FULL_RECORD")}
                  style={filterType === "FULL_RECORD" ? styles.chipActive : styles.chip}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType(filterType === "PROGRESS" ? "" : "PROGRESS")}
                  style={filterType === "PROGRESS" ? styles.chipActive : styles.chip}
                >
                  Progress
                </button>
              </div>
            </div>
          )}
        </div>

        {!centerId ? (
          <EmptyPlaceholder
            icon={<SvgBuilding size={28} />}
            title="No center selected"
            desc="Choose a center from the form above to view existing archives."
          />
        ) : archiveLoading ? (
          <div style={styles.loadingContainer}>
            <SvgSpinner size={20} />
            <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Loading archives...</span>
          </div>
        ) : filteredArchives.length === 0 ? (
          <EmptyPlaceholder
            icon={<SvgArchive size={28} />}
            title={search || filterType ? "No matching archives" : "No archives yet"}
            desc={
              search || filterType
                ? "Try adjusting your search or filter."
                : `Create your first archive for the ${schoolYear} school year using the form above.`
            }
          />
        ) : (
          <div style={styles.archiveList}>
            {filteredArchives.map((a) => {
              const isExpanded = expandedId === a.id;
              const meta = ARCHIVE_TYPE_META[a.archiveType] || ARCHIVE_TYPE_META.FULL_RECORD;
              const isDownloading = downloadingId === a.id;
              const archivedDate = new Date(a.archivedAt);
              const formattedDate = archivedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = archivedDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={a.id}
                  style={{
                    ...styles.archiveCard,
                    ...(isExpanded ? styles.archiveCardExpanded : {}),
                  }}
                >
                  {/* Card Row */}
                  <div
                    style={styles.archiveRow}
                    onClick={() => setExpandedId(isExpanded ? "" : a.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Left: avatar + info */}
                    <div style={styles.archiveInfo}>
                      <div style={styles.childAvatar}>
                        {(a.childName || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={styles.childName}>{a.childName || "Unknown"}</div>
                        <div style={styles.archiveMeta}>
                          <span style={a.archiveType === "FULL_RECORD" ? styles.typeBadgeFull : styles.typeBadgeProgress}>
                            {meta.label}
                          </span>
                          <span style={styles.yearBadge}>{a.schoolYear}</span>
                          <span style={styles.dateMuted}>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div style={styles.archiveActions}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadArchive(a.id, "json");
                        }}
                        disabled={isDownloading}
                        style={styles.downloadBtn}
                        title="Download JSON"
                      >
                        <SvgDownload size={13} />
                        JSON
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadArchive(a.id, "csv");
                        }}
                        disabled={isDownloading}
                        style={styles.downloadBtn}
                        title="Download CSV"
                      >
                        <SvgDownload size={13} />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteArchive(a.id);
                        }}
                        style={styles.deleteBtn}
                        title="Delete archive"
                      >
                        <SvgTrash size={13} />
                      </button>
                      <span style={styles.chevron(isExpanded)}>
                        <SvgChevron size={14} />
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={styles.expandedPanel}>
                      <div style={styles.detailGrid}>
                        <DetailItem label="Child" value={a.childName} />
                        <DetailItem label="Archive Type" value={meta.label} />
                        <DetailItem label="School Year" value={a.schoolYear} />
                        <DetailItem label="Archived" value={`${formattedDate} at ${formattedTime}`} />
                        <DetailItem label="Archive ID" value={a.id} mono />
                      </div>
                      <div style={styles.expandedActions}>
                        <button
                          type="button"
                          onClick={() => downloadArchive(a.id, "json")}
                          disabled={isDownloading}
                          style={styles.expandedDownloadBtn}
                        >
                          <SvgDownload size={14} />
                          {isDownloading ? "Downloading..." : "Download JSON"}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadArchive(a.id, "csv")}
                          disabled={isDownloading}
                          style={styles.expandedDownloadBtn}
                        >
                          <SvgDownload size={14} />
                          {isDownloading ? "Downloading..." : "Download CSV"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteArchive(a.id)}
                          style={styles.expandedDeleteBtn}
                        >
                          <SvgTrash size={14} />
                          Delete Archive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

/* ─── Sub-components ─── */

function Field({ label, required, hint, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={styles.fieldLabel}>
        {label}
        {required && <span style={{ color: "var(--admin-danger-accent-text)" }}>*</span>}
        {hint && <span style={styles.fieldHint}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StatCard({ label, value, icon, color, bg }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: bg, color }}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, mono }) {
  return (
    <div>
      <div style={styles.detailLabel}>{label}</div>
      <div style={{ ...styles.detailValue, ...(mono ? { fontFamily: "monospace", fontSize: 11 } : {}) }}>
        {value || "—"}
      </div>
    </div>
  );
}

function EmptyPlaceholder({ icon, title, desc }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <div style={styles.emptyTitle}>{title}</div>
      <div style={styles.emptyDesc}>{desc}</div>
    </div>
  );
}

/* ─── SVG Icons ─── */

function SvgArchive({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function SvgBuilding({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function SvgCalendar({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function SvgUser({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function SvgFolder({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function SvgChart({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function SvgPlus({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function SvgSearch({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SvgDownload({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function SvgTrash({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function SvgChevron({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function SvgAlertCircle({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

function SvgCheckCircle({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function SvgSpinner({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" opacity="0.3" />
      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </svg>
  );
}

/* ─── Styles ─── */

const styles = {
  /* Header card */
  headerCard: {
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    padding: 20,
  },
  headerTop: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "var(--admin-info-bg)",
    color: "var(--admin-info-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "var(--admin-text)",
    letterSpacing: "-0.01em",
  },
  pageDesc: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "var(--admin-text-muted)",
    lineHeight: 1.5,
    maxWidth: 560,
  },

  /* Alerts */
  alertError: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    marginTop: 14,
    borderRadius: 10,
    border: "1px solid var(--admin-error-border)",
    background: "var(--admin-error-bg)",
    color: "var(--admin-error-text)",
    fontSize: 13,
  },
  alertSuccess: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    marginTop: 14,
    borderRadius: 10,
    border: "1px solid var(--admin-success-border)",
    background: "var(--admin-success-bg)",
    color: "var(--admin-success-text)",
    fontSize: 13,
  },
  alertClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    opacity: 0.6,
    color: "inherit",
    padding: "0 2px",
  },

  /* Form */
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginTop: 20,
  },
  fieldLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--admin-text-muted)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  fieldHint: {
    fontWeight: 500,
    textTransform: "none",
    letterSpacing: 0,
    color: "var(--admin-text-faint)",
  },
  selectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    background: "var(--admin-bg-secondary)",
    color: "var(--admin-text-muted)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  selectWithIcon: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    background: "transparent",
    color: "var(--admin-text)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    minWidth: 0,
  },
  typeToggle: {
    display: "flex",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    overflow: "hidden",
  },
  typeToggleActive: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 8px",
    border: "none",
    background: "var(--admin-info-bg)",
    color: "var(--admin-info-text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  typeToggleInactive: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 8px",
    border: "none",
    background: "var(--admin-bg-secondary)",
    color: "var(--admin-text-muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  /* Buttons */
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)",
    transition: "background 0.15s, box-shadow 0.15s",
  },

  /* Stats */
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--admin-text)",
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--admin-text-muted)",
    marginTop: 2,
  },

  /* Archive list */
  listCard: {
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  listHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  listTitle: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 800,
    color: "var(--admin-text)",
  },
  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    height: 22,
    padding: "0 6px",
    borderRadius: 999,
    background: "var(--admin-bg-tertiary)",
    color: "var(--admin-text-muted)",
    fontSize: 11,
    fontWeight: 700,
  },
  listToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  searchWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    background: "var(--admin-bg-secondary)",
    color: "var(--admin-text-faint)",
  },
  searchInput: {
    padding: "8px 0",
    border: "none",
    background: "transparent",
    color: "var(--admin-text)",
    fontSize: 13,
    outline: "none",
    width: 180,
  },
  filterChips: {
    display: "flex",
    gap: 4,
  },
  chip: {
    padding: "6px 12px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    background: "var(--admin-bg)",
    color: "var(--admin-text-muted)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  chipActive: {
    padding: "6px 12px",
    border: "1px solid var(--admin-info-border)",
    borderRadius: 8,
    background: "var(--admin-info-bg)",
    color: "var(--admin-info-text)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },

  /* Archive cards */
  archiveList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  archiveCard: {
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    background: "var(--admin-bg)",
    overflow: "hidden",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  archiveCardExpanded: {
    borderColor: "var(--admin-info-border)",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.08)",
  },
  archiveRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    cursor: "pointer",
  },
  archiveInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },
  childAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "linear-gradient(135deg, var(--admin-info-bg), var(--admin-accent-bg))",
    color: "var(--admin-info-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 15,
    flexShrink: 0,
  },
  childName: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--admin-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  archiveMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    flexWrap: "wrap",
  },
  typeBadgeFull: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--admin-info-border)",
    background: "var(--admin-info-bg)",
    color: "var(--admin-info-text)",
    fontSize: 10,
    fontWeight: 700,
  },
  typeBadgeProgress: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--admin-success-border)",
    background: "var(--admin-success-bg)",
    color: "var(--admin-success-text)",
    fontSize: 10,
    fontWeight: 700,
  },
  yearBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--admin-bg-tertiary)",
    color: "var(--admin-text-secondary)",
    fontSize: 10,
    fontWeight: 700,
  },
  dateMuted: {
    fontSize: 11,
    color: "var(--admin-text-faint)",
  },
  archiveActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  downloadBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    background: "var(--admin-bg)",
    color: "var(--admin-text-secondary)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  deleteBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: 6,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "var(--admin-text-faint)",
    cursor: "pointer",
    transition: "color 0.15s, background 0.15s",
  },
  chevron: (open) => ({
    display: "inline-flex",
    color: "var(--admin-text-faint)",
    transition: "transform 0.2s",
    transform: open ? "rotate(180deg)" : "rotate(0deg)",
  }),

  /* Expanded panel */
  expandedPanel: {
    borderTop: "1px solid var(--admin-border-light)",
    padding: 16,
    background: "var(--admin-bg-secondary)",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 14,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--admin-text-faint)",
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--admin-text)",
  },
  expandedActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  expandedDownloadBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    background: "var(--admin-bg)",
    color: "var(--admin-text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  expandedDeleteBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    border: "1px solid var(--admin-error-border)",
    borderRadius: 8,
    background: "var(--admin-danger-accent-bg)",
    color: "var(--admin-danger-accent-text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    marginLeft: "auto",
  },

  /* Empty state */
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "var(--admin-bg-tertiary)",
    color: "var(--admin-text-faint)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: 700,
    color: "var(--admin-text)",
  },
  emptyDesc: {
    marginTop: 4,
    fontSize: 12,
    color: "var(--admin-text-muted)",
    maxWidth: 300,
    lineHeight: 1.5,
  },

  /* Loading */
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "48px 20px",
  },
};
