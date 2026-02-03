import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [centerId, setCenterId] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [cls, c] = await Promise.all([apiJson("/api/v1/classes"), apiJson("/api/v1/centers")]);
      setClasses(Array.isArray(cls) ? cls : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);

  const sorted = useMemo(() => {
    return [...classes].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [classes]);

  function resetForm() {
    setEditing(null);
    setName("");
    setCenterId("");
  }

  function startEdit(cl) {
    setEditing(cl);
    setName(cl.name || "");
    setCenterId(cl.centerId || "");
  }

  async function createClass(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/v1/classes", {
        method: "POST",
        body: JSON.stringify({ name, centerId }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create class");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiJson(`/api/v1/classes/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update class");
    }
  }

  async function deleteClass(id) {
    if (!confirm("Delete this class? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/classes/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete class");
    }
  }

  return (
    <AdminLayout title="Classes">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Classes</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Classroom setup: create/modify/delete class rooms.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={editing ? saveEdit : createClass} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
            <Field label="Class Name">
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
            </Field>
            <Field label={editing ? "Center (create only)" : "Center"}>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                style={inputStyle}
                required={!editing}
                disabled={!!editing}
              >
                <option value="">{editing ? "(unchanged)" : "Select a center"}</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="submit" style={primaryButton}>
                {editing ? "Save" : "Create"}
              </button>
              <button type="button" style={secondaryButton} onClick={resetForm}>
                Clear
              </button>
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
                  <th style={thStyle}>Center</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cl) => (
                  <tr key={cl.id}>
                    <td style={tdStyle}>{cl.name}</td>
                    <td style={tdStyle}>{centerById[cl.centerId]?.name || cl.centerId}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={secondaryButton} onClick={() => startEdit(cl)}>
                          Edit
                        </button>
                        <button type="button" style={dangerButton} onClick={() => deleteClass(cl.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={3}>
                      No classes found.
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
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
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

