import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...centers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [centers]);

  async function createCenter(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/v1/centers", {
        method: "POST",
        body: JSON.stringify({ name, address }),
      });
      setName("");
      setAddress("");
      setShowForm(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create center");
    }
  }

  function startEdit(center) {
    setEditing(center);
    setName(center.name || "");
    setAddress(center.address || "");
    setShowForm(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiJson(`/api/v1/centers/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, address }),
      });
      setEditing(null);
      setName("");
      setAddress("");
      setShowForm(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update center");
    }
  }

  function cancelForm() {
    setEditing(null);
    setName("");
    setAddress("");
    setShowForm(false);
  }

  async function deleteCenter(id) {
    setError("");
    try {
      await apiJson(`/api/v1/centers/${id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete center");
      setDeleteTarget(null);
    }
  }

  const activeCount = centers.filter((c) => c.subscription?.active).length;

  return (
    <AdminLayout title="Centers">
      {/* Stats */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon="🏫" label="Total Centers" value={centers.length} color="#2563eb" bg="#DBEAFE" />
          <StatCard icon="✅" label="Active Subscriptions" value={activeCount} color="#059669" bg="#D1FAE5" />
          <StatCard icon="⏸️" label="Inactive" value={centers.length - activeCount} color="#D97706" bg="#FEF3C7" />
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Centers</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13 }}>
              Create, update, and manage your childcare centers.
            </p>
          </div>
          {!showForm && (
            <button type="button" style={primaryBtnStyle} onClick={() => setShowForm(true)}>
              <span style={{ fontSize: 16 }}>+</span> Add Center
            </button>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Inline Form */}
        {showForm && (
          <form onSubmit={editing ? saveEdit : createCenter} style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #BFDBFE", background: "#EFF6FF" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF", marginBottom: 12 }}>
              {editing ? "Edit Center" : "New Center"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Name *</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Center name"
                />
              </label>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Address</div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={inputStyle}
                  placeholder="Street address"
                />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" style={secondaryBtnStyle} onClick={cancelForm}>
                Cancel
              </button>
              <button type="submit" style={primaryBtnStyle}>
                {editing ? "Save Changes" : "Create Center"}
              </button>
            </div>
          </form>
        )}

        {/* Centers List */}
        <div style={{ marginTop: 20 }}>
          {loading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto" }}>🏫</div>
              <p style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>No centers yet</p>
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>Create your first center to get started.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sorted.map((c) => {
                const isActive = c.subscription?.active;
                const tier = c.subscription?.tier;
                return (
                  <div
                    key={c.id}
                    style={cardStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                      🏫
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>{c.name}</span>
                        {tier && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: isActive ? "#D1FAE5" : "#FEF3C7",
                            color: isActive ? "#065F46" : "#92400E",
                            border: `1px solid ${isActive ? "#A7F3D0" : "#FDE68A"}`,
                            textTransform: "uppercase", letterSpacing: "0.04em",
                          }}>
                            {tier} · {isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                        {!tier && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                            No subscription
                          </span>
                        )}
                      </div>
                      {c.address && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                          📍 {c.address}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" style={cardActionBtn} onClick={() => startEdit(c)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button type="button" style={cardDangerBtn} onClick={() => setDeleteTarget(c.id)}>
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
        title="Delete Center"
        message="Are you sure you want to delete this center? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteCenter(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: bg, fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, marginTop: 12, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600 }}>
      {message}
    </div>
  );
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
