import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

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

  function toggleRole(r) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  function resetForm() {
    setTitle(""); setDescription(""); setUrl(""); setCenterId(""); setRoles(["TEACHER"]);
    setEditingId(null);
  }

  function startEdit(d) {
    setEditingId(d.id);
    setTitle(d.title);
    setDescription(d.description || "");
    setUrl(d.url);
    setCenterId(d.centerId || "");
    setRoles(d.roles || ["TEACHER"]);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(""); setSuccess("");
    try {
      if (editingId) {
        await apiJson(`/api/v1/policies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ title, description: description || null, url, roles, centerId: centerId || null }),
        });
        setSuccess("Policy updated.");
      } else {
        await apiJson("/api/v1/policies", {
          method: "POST",
          body: JSON.stringify({ title, description: description || null, url, roles, centerId: centerId || null }),
        });
        setSuccess("Policy published.");
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
    if (!cId) return "All centers";
    const c = centers.find(x => x.id === cId);
    return c ? c.name : cId;
  }

  return (
    <AdminLayout title="Policies">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>Policies & Procedures</h1>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: 0 }}>
              Publish role-based policy documents (URLs to PDFs/pages).
            </p>
          </div>
          <button type="button" onClick={() => { resetForm(); setShowForm(!showForm); }}
            style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {showForm ? "Cancel" : "+ Add Policy"}
          </button>
        </div>

        {error && <Banner kind="error" message={error} />}
        {success && <Banner kind="success" message={success} />}

        {/* Create/Edit Form */}
        {showForm && (
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{editingId ? "Edit Policy" : "Add Policy"}</div>
            <form onSubmit={save}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Title *">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />
                </Field>
                <Field label="URL (PDF or page) *">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} required />
                </Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="Description (optional)">
                  <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="Center (optional)">
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                    <option value="">(all centers)</option>
                    {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 6 }}>Roles *</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ROLES.map((r) => (
                    <button key={r} type="button" onClick={() => toggleRole(r)} style={chip(roles.includes(r))}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" disabled={saving || roles.length === 0}
                  style={{ ...primaryButton, opacity: saving || roles.length === 0 ? 0.6 : 1, cursor: saving || roles.length === 0 ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : editingId ? "Update Policy" : "Publish"}
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                  style={{ padding: "8px 14px", background: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policies…"
            style={{ ...inputStyle, maxWidth: 320 }}
          />
        </div>

        {/* Policy list */}
        <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px 0", fontWeight: 700, fontSize: 15 }}>Published ({sorted.length})</h3>
          {loading ? (
            <p style={{ color: "var(--admin-text-muted)" }}>Loading…</p>
          ) : sorted.length === 0 ? (
            <p style={{ color: "var(--admin-text-muted)" }}>No policies found.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {sorted.map((d) => (
                <div key={d.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{d.title}</div>
                      {d.description && <div style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13 }}>{d.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => startEdit(d)}
                        style={{ fontSize: 11, padding: "3px 8px", background: "var(--admin-accent-bg)", color: "var(--admin-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(d.id)}
                        style={{ fontSize: 11, padding: "3px 8px", background: "var(--admin-danger-accent-bg)", color: "var(--admin-danger-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--admin-accent-text)", fontSize: 13 }}>
                      Open Document
                    </a>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(d.roles || []).map((r) => (
                      <span key={r} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "var(--admin-accent-bg)", color: "var(--admin-accent-text)" }}>
                        {r}
                      </span>
                    ))}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "var(--admin-bg-tertiary)", color: "var(--admin-text-muted)" }}>
                      {getCenterName(d.centerId)}
                    </span>
                  </div>
                </div>
              ))}
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

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function Banner({ message, kind }) {
  const style =
    kind === "success"
      ? { background: "var(--admin-success-bg)", color: "var(--admin-success-text)", border: "1px solid var(--admin-success-border)" }
      : { background: "var(--admin-error-bg)", color: "var(--admin-error-text)", border: "1px solid var(--admin-error-border)" };
  return <div style={{ padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, ...style }}>{message}</div>;
}

const inputStyle = {
  width: "100%",
  padding: 8,
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
};

function chip(active) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid var(--admin-info-border)" : "1px solid var(--admin-border)",
    background: active ? "var(--admin-accent-bg)" : "var(--admin-bg)",
    cursor: "pointer",
    fontWeight: 700,
    color: "var(--admin-text)",
    fontSize: 12,
  };
}

const primaryButton = {
  padding: "8px 16px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const cardStyle = {
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  padding: 14,
};
