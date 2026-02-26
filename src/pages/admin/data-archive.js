import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function schoolYearOptions() {
  const now = new Date();
  const y = now.getFullYear();
  const opts = [];
  for (let i = y - 3; i <= y + 1; i++) opts.push(`${i}-${i + 1}`);
  return opts;
}

export default function DataArchivePage() {
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [centerId, setCenterId] = useState("");
  const [schoolYear, setSchoolYear] = useState(schoolYearOptions()[3] || "");
  const [childId, setChildId] = useState("");
  const [archiveType, setArchiveType] = useState("FULL_RECORD");

  useEffect(() => {
    apiJson("/api/v1/centers").then((c) => setCenters(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!centerId) { setChildren([]); setArchives([]); return; }
    apiJson(`/api/v1/children?centerId=${centerId}`).then((c) => setChildren(Array.isArray(c) ? c : [])).catch(() => {});
    loadArchives();
  }, [centerId, schoolYear]);

  async function loadArchives() {
    if (!centerId) return;
    try {
      const q = new URLSearchParams({ centerId });
      if (schoolYear) q.set("schoolYear", schoolYear);
      const data = await apiJson(`/api/v1/data-archive?${q}`);
      setArchives(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function createArchive() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await apiJson("/api/v1/data-archive", {
        method: "POST",
        body: JSON.stringify({ centerId, schoolYear, childId: childId || null, archiveType }),
      });
      setSuccess("Archive created.");
      await loadArchives();
    } catch (e) {
      setError(e.message || "Failed to create archive");
    } finally {
      setLoading(false);
    }
  }

  async function downloadArchive(archiveId, format) {
    try {
      const archive = await apiJson(`/api/v1/data-archive/${encodeURIComponent(archiveId)}`);
      let content, mimeType, ext;
      if (format === "csv") {
        const records = archive.data?.progressRecords || [];
        const rows = [["Lesson", "Category", "Goal", "Status", "Achieved At"]];
        for (const pr of records) {
          rows.push([pr.lesson?.title || "", pr.lesson?.category || "", String(pr.goalIndex), pr.status, pr.achievedAt || ""]);
        }
        content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        mimeType = "text/csv"; ext = "csv";
      } else {
        content = JSON.stringify(archive.data, null, 2);
        mimeType = "application/json"; ext = "json";
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
    }
  }

  async function deleteArchive(archiveId) {
    if (!confirm("Delete this archive?")) return;
    try {
      await apiJson(`/api/v1/data-archive/${encodeURIComponent(archiveId)}`, { method: "DELETE" });
      setSuccess("Archive deleted."); await loadArchives();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  return (
    <AdminLayout title="Data Archive">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Data Archive</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create comprehensive archives of child records including progress, activities, attendance, forms, and behavior plans.
        </p>

        {error && <Banner kind="error" message={error} />}
        {success && <Banner kind="success" message={success} />}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 16 }}>
          <Field label="Center">
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
              <option value="">Select center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="School Year">
            <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} style={inputStyle}>
              {schoolYearOptions().map((sy) => <option key={sy} value={sy}>{sy}</option>)}
            </select>
          </Field>
          <Field label="Child (optional)">
            <select value={childId} onChange={(e) => setChildId(e.target.value)} style={inputStyle}>
              <option value="">(All children)</option>
              {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName || ""}</option>)}
            </select>
          </Field>
          <Field label="Archive Type">
            <select value={archiveType} onChange={(e) => setArchiveType(e.target.value)} style={inputStyle}>
              <option value="FULL_RECORD">Full Record</option>
              <option value="PROGRESS">Progress Only</option>
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={createArchive} disabled={!centerId || loading} style={primaryButton}>
            {loading ? "Archiving..." : "Create Archive"}
          </button>
        </div>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Archives</h3>
        {!centerId ? (
          <p style={{ color: "#6b7280" }}>Select a center to view archives.</p>
        ) : archives.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No archives found.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Child</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>School Year</th>
                <th style={thStyle}>Archived</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archives.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.childName}</td>
                  <td style={tdStyle}><span style={pill(a.archiveType === "FULL_RECORD")}>{a.archiveType === "FULL_RECORD" ? "Full" : "Progress"}</span></td>
                  <td style={tdStyle}>{a.schoolYear}</td>
                  <td style={tdStyle}>{new Date(a.archivedAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => downloadArchive(a.id, "json")} style={miniBtn}>JSON</button>
                      <button type="button" onClick={() => downloadArchive(a.id, "csv")} style={miniBtn}>CSV</button>
                      <button type="button" onClick={() => deleteArchive(a.id)} style={miniDangerBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children, style }) {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, ...style }}>{children}</div>;
}
function Field({ label, children }) {
  return <label style={{ display: "block" }}><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>{children}</label>;
}
function Banner({ message, kind }) {
  const s = kind === "success" ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" } : { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  return <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...s }}>{message}</div>;
}
function pill(active) {
  return { fontSize: 11, padding: "3px 8px", borderRadius: 999, border: `1px solid ${active ? "#bfdbfe" : "#e5e7eb"}`, background: active ? "#dbeafe" : "#f3f4f6", color: active ? "#1e40af" : "#374151", fontWeight: 800 };
}

const inputStyle = { width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, boxSizing: "border-box" };
const primaryButton = { padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle = { padding: "8px 10px", background: "#f9fafb", borderBottom: "2px solid #e5e7eb", textAlign: "left", fontWeight: 800, fontSize: 12 };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" };
const miniBtn = { padding: "5px 8px", background: "white", color: "#111827", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 11 };
const miniDangerBtn = { padding: "5px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 11 };
