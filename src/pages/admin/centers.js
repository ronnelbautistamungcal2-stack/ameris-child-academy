import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(null);

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
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create center");
    }
  }

  function startEdit(center) {
    setEditing(center);
    setName(center.name || "");
    setAddress(center.address || "");
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
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update center");
    }
  }

  async function deleteCenter(id) {
    if (!confirm("Delete this center? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/centers/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete center");
    }
  }

  return (
    <AdminLayout title="Centers">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Centers</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create/update/delete centers and view subscription status.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={editing ? saveEdit : createCenter} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Address">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="submit" style={primaryButton}>
                {editing ? "Save" : "Create"}
              </button>
              {editing ? (
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => {
                    setEditing(null);
                    setName("");
                    setAddress("");
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle}>Subscription</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.id}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={tdStyle}>{c.address || "—"}</td>
                    <td style={tdStyle}>
                      {c.subscription
                        ? `${c.subscription.tier || "—"} (${c.subscription.active ? "active" : "inactive"})`
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={secondaryButton}
                          onClick={() => startEdit(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={dangerButton}
                          onClick={() => deleteCenter(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={4}>
                      No centers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function ErrorBanner({ message }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#fee2e2",
        color: "#991b1b",
        borderRadius: 8,
        marginTop: 12,
        border: "1px solid #fecaca",
      }}
    >
      {message}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
};

const thStyle = {
  textAlign: "left",
  fontSize: 12,
  color: "#6b7280",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButton = {
  padding: "10px 12px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const dangerButton = {
  padding: "10px 12px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

