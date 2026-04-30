import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "OTHER_STAFF", "PARENT", "COACH", "SUBSCRIBER"];

const ROLE_COLORS = {
  ADMIN: { bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD" },
  TEACHER: { bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },
  OTHER_STAFF: { bg: "#ECFEFF", color: "#0E7490", border: "#A5F3FC" },
  PARENT: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  COACH: { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
  SUBSCRIBER: { bg: "#FCE7F3", color: "#9D174D", border: "#F9A8D4" },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      if (idx === -1) return reject(new Error("Invalid file encoding"));
      resolve(result.slice(idx + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function AdminPolicies() {
  const [docs, setDocs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [centerId, setCenterId] = useState("");
  const [roles, setRoles] = useState(["TEACHER"]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // File upload state
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [p, c] = await Promise.all([
        apiJson("/api/v1/policies"),
        apiJson("/api/v1/centers"),
      ]);
      setDocs(Array.isArray(p) ? p : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const sorted = useMemo(() => {
    let list = [...docs].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.title || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [docs, search]);

  const totalRoles = useMemo(() => {
    const set = new Set();
    docs.forEach(d => (d.roles || []).forEach(r => set.add(r)));
    return set.size;
  }, [docs]);

  const centerSpecific = docs.filter(d => d.centerId).length;

  function toggleRole(r) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  function resetForm() {
    setTitle(""); setDescription(""); setUrl(""); setCenterId(""); setRoles(["TEACHER"]);
    setEditingId(null); setPdfFile(null);
  }

  function startEdit(d) {
    setEditingId(d.id);
    setTitle(d.title);
    setDescription(d.description || "");
    setUrl(d.url);
    setCenterId(d.centerId || "");
    setRoles(d.roles || ["TEACHER"]);
    setPdfFile(null);
    setShowForm(true);
  }

  // File handling
  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10 MB.");
      return;
    }
    setError("");
    setPdfFile(file);
    // Auto-fill title from filename if empty
    if (!title) {
      const name = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [title]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFileSelect(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  async function uploadPdf() {
    if (!pdfFile) return url; // keep existing URL if editing without new file
    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(pdfFile);
      const result = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({
          filename: pdfFile.name,
          mimeType: pdfFile.type,
          dataBase64,
        }),
      });
      return result.url;
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    // Must have either a file or existing URL (when editing)
    if (!pdfFile && !url) {
      setError("Please upload a PDF file.");
      return;
    }
    setSaving(true);
    setError(""); setSuccess("");
    try {
      let finalUrl = url;
      if (pdfFile) {
        finalUrl = await uploadPdf();
      }
      if (editingId) {
        await apiJson(`/api/v1/policies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ title, description: description || null, url: finalUrl, roles, centerId: centerId || null }),
        });
        setSuccess("Policy updated successfully.");
      } else {
        await apiJson("/api/v1/policies", {
          method: "POST",
          body: JSON.stringify({ title, description: description || null, url: finalUrl, roles, centerId: centerId || null }),
        });
        setSuccess("Policy published successfully.");
      }
      resetForm();
      setShowForm(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  async function deletePolicy(id) {
    setError(""); setSuccess("");
    try {
      await apiJson(`/api/v1/policies/${id}`, { method: "DELETE" });
      setSuccess("Policy deleted.");
      setDeleteTarget(null);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete policy");
      setDeleteTarget(null);
    }
  }

  function getCenterName(cId) {
    if (!cId) return "All Centers";
    const c = centers.find(x => x.id === cId);
    return c ? c.name : cId;
  }

  const isBusy = saving || uploading;

  return (
    <AdminLayout title="Policies">
      {/* Stats */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon={<DocIcon />} label="Total Policies" value={docs.length} color="#2563eb" bg="#DBEAFE" />
          <StatCard icon={<RolesIcon />} label="Roles Covered" value={totalRoles} color="#059669" bg="#D1FAE5" />
          <StatCard icon={<CenterIcon />} label="Center-Specific" value={centerSpecific} color="#D97706" bg="#FEF3C7" />
        </div>
      )}

      {/* Main Panel */}
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Policies & Procedures</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0 0" }}>
              Upload and manage role-based policy PDF documents.
            </p>
          </div>
          {!showForm && (
            <button type="button" style={primaryBtnStyle} onClick={() => { resetForm(); setShowForm(true); }}>
              <span style={{ fontSize: 16 }}>+</span> Add Policy
            </button>
          )}
        </div>

        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}

        {/* Inline Form */}
        {showForm && (
          <form onSubmit={save} style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #BFDBFE", background: "#EFF6FF" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF", marginBottom: 12 }}>
              {editingId ? "Edit Policy" : "New Policy"}
            </div>

            {/* PDF Upload Zone */}
            <div style={{ marginBottom: 12 }}>
              <div style={fieldLabelStyle}>PDF Document {editingId ? "" : "*"}</div>

              {pdfFile ? (
                /* File selected preview */
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10,
                  border: "1.5px solid #86EFAC", background: "#F0FDF4",
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: "#DC2626",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <PdfBadge />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pdfFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>
                      {formatFileSize(pdfFile.size)} &middot; Ready to upload
                    </div>
                  </div>
                  <button type="button" onClick={() => setPdfFile(null)} style={{
                    padding: "5px 10px", borderRadius: 8, border: "1px solid #FCA5A5",
                    background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 600, fontSize: 12,
                  }}>
                    Remove
                  </button>
                </div>
              ) : editingId && url ? (
                /* Editing: show current file with option to replace */
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10,
                  border: "1.5px solid #93C5FD", background: "#EFF6FF",
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: "#DC2626",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <PdfBadge />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1E40AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Current: {url.split("/").pop()}
                    </div>
                    <div style={{ fontSize: 11, color: "#60A5FA", marginTop: 2 }}>
                      Upload a new file below to replace it
                    </div>
                  </div>
                  <a href={url} target="_blank" rel="noreferrer" style={{
                    padding: "5px 10px", borderRadius: 8, border: "1px solid #93C5FD",
                    background: "white", color: "#2563EB", textDecoration: "none", fontWeight: 600, fontSize: 12,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <ExternalIcon size={12} /> View
                  </a>
                </div>
              ) : null}

              {/* Drop zone (always show if no file selected) */}
              {!pdfFile && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    marginTop: editingId && url ? 8 : 0,
                    padding: "24px 16px",
                    borderRadius: 10,
                    border: `2px dashed ${dragOver ? "#2563EB" : "#93C5FD"}`,
                    background: dragOver ? "#DBEAFE" : "white",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: dragOver ? "#BFDBFE" : "#EFF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      <UploadIcon color={dragOver ? "#1E40AF" : "#60A5FA"} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#2563EB" }}>Click to upload</span>
                      <span style={{ fontSize: 13, color: "#6B7280" }}> or drag and drop</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>PDF only, max 10 MB</div>
                  </div>
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Title *</div>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} placeholder="Policy title" />
              </label>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Description</div>
                <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder="Brief description (optional)" />
              </label>
            </div>

            {/* Center & Roles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Center</div>
                <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                  <option value="">All Centers</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div>
                <div style={fieldLabelStyle}>Visible to Roles *</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {ROLES.map((r) => {
                    const active = roles.includes(r);
                    const rc = ROLE_COLORS[r];
                    return (
                      <button key={r} type="button" onClick={() => toggleRole(r)} style={{
                        padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 11,
                        letterSpacing: "0.03em", transition: "all 0.15s",
                        background: active ? rc.bg : "white",
                        color: active ? rc.color : "#9CA3AF",
                        border: `1.5px solid ${active ? rc.border : "#E5E7EB"}`,
                      }}>
                        {active && <span style={{ marginRight: 4 }}>&#10003;</span>}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" style={secondaryBtnStyle} onClick={() => { resetForm(); setShowForm(false); }}>Cancel</button>
              <button type="submit" disabled={isBusy || roles.length === 0} style={{
                ...primaryBtnStyle,
                opacity: isBusy || roles.length === 0 ? 0.6 : 1,
                cursor: isBusy || roles.length === 0 ? "not-allowed" : "pointer",
              }}>
                {uploading ? "Uploading..." : saving ? "Saving..." : editingId ? "Save Changes" : "Publish Policy"}
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div style={{ marginTop: 16, position: "relative", maxWidth: 340 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
            <SearchIcon />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policies..."
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>

        {/* Policy List */}
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <p style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>
                {search ? "No policies match your search" : "No policies yet"}
              </p>
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                {search ? "Try a different search term." : "Upload your first policy PDF to get started."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sorted.map((d) => {
                const fileName = d.url ? d.url.split("/").pop() : "";
                const isPdf = fileName.toLowerCase().endsWith(".pdf");
                return (
                  <div
                    key={d.id}
                    style={cardStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: isPdf ? "#DC2626" : "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {isPdf ? <PdfBadge /> : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>{d.title}</span>
                        {isPdf && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA", letterSpacing: "0.05em" }}>
                            PDF
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          background: d.centerId ? "#FEF3C7" : "#F3F4F6",
                          color: d.centerId ? "#92400E" : "#6B7280",
                          border: `1px solid ${d.centerId ? "#FDE68A" : "#E5E7EB"}`,
                        }}>
                          {getCenterName(d.centerId)}
                        </span>
                      </div>
                      {d.description && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.4 }}>{d.description}</div>
                      )}
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {(d.roles || []).map((r) => {
                          const rc = ROLE_COLORS[r] || { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };
                          return (
                            <span key={r} style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                              background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>
                              {r}
                            </span>
                          );
                        })}
                        <a href={d.url} target="_blank" rel="noreferrer" style={{
                          fontSize: 11, fontWeight: 600, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4,
                          textDecoration: "none", marginLeft: 4,
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                        >
                          <ExternalIcon size={12} />
                          {isPdf ? "View PDF" : "Open"}
                        </a>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" style={cardActionBtn} onClick={() => startEdit(d)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button type="button" style={cardDangerBtn} onClick={() => setDeleteTarget(d.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Policy"
        message="Are you sure you want to delete this policy document? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deletePolicy(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
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

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function DocIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}

function RolesIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}

function CenterIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}

function UploadIcon({ color = "#60A5FA" }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}

function PdfBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="1" width="18" height="22" rx="2" stroke="white" strokeWidth="1.5"/>
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui">PDF</text>
    </svg>
  );
}

function ExternalIcon({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
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

const secondaryBtnStyle = {
  padding: "10px 16px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
