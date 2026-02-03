import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminChildren() {
  const [children, setChildren] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [centerId, setCenterId] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [parentId, setParentId] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [kids, c, cls, u] = await Promise.all([
        apiJson("/api/v1/children"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
        apiJson("/api/v1/users"),
      ]);
      setChildren(Array.isArray(kids) ? kids : []);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const parents = useMemo(() => {
    return users.filter((u) => u.role === "PARENT").sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users]);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const sorted = useMemo(() => {
    return [...children].sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children]);

  function resetForm() {
    setEditing(null);
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setCenterId("");
    setClassRoomId("");
    setParentId("");
  }

  function startEdit(child) {
    setEditing(child);
    setFirstName(child.firstName || "");
    setLastName(child.lastName || "");
    setBirthDate(child.birthDate ? child.birthDate.slice(0, 10) : "");
    setCenterId(child.centerId || "");
    setClassRoomId(child.classRoomId || "");
    setParentId(child.parentId || "");
  }

  async function createChild(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/v1/children", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          centerId,
          classRoomId: classRoomId || null,
          parentId: parentId || null,
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create child");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiJson(`/api/v1/children/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          classRoomId: classRoomId || null,
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update child");
    }
  }

  async function deleteChild(id) {
    if (!confirm("Delete this child? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/children/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete child");
    }
  }

  return (
    <AdminLayout title="Children">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Children</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Student setup: create/modify/delete child records and assign to center/class/parent.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={editing ? saveEdit : createChild} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px", gap: 10 }}>
            <Field label="First Name">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} required />
            </Field>
            <Field label="Last Name">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Birth Date">
              <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={inputStyle} type="date" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginTop: 10 }}>
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
            <Field label="Class">
              <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} style={inputStyle}>
                <option value="">(none)</option>
                {classes
                  .filter((cl) => !centerId || cl.centerId === centerId)
                  .map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={editing ? "Parent (create only)" : "Parent"}>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={inputStyle} disabled={!!editing}>
                <option value="">{editing ? "(unchanged)" : "(none)"}</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.email}
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
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>Parent</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((ch) => (
                  <tr key={ch.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>
                        {ch.firstName} {ch.lastName || ""}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        {ch.birthDate ? `Born ${new Date(ch.birthDate).toLocaleDateString()}` : "—"}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        <code style={codePill}>{ch.id}</code>
                      </div>
                    </td>
                    <td style={tdStyle}>{centerById[ch.centerId]?.name || ch.centerId || "—"}</td>
                    <td style={tdStyle}>{ch.classRoomId ? classById[ch.classRoomId]?.name || ch.classRoomId : "—"}</td>
                    <td style={tdStyle}>{ch.parentId || "—"}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={secondaryButton} onClick={() => startEdit(ch)}>
                          Edit
                        </button>
                        <button type="button" style={dangerButton} onClick={() => deleteChild(ch.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      No children found.
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
  verticalAlign: "top",
};

const codePill = {
  background: "#f3f4f6",
  padding: "2px 8px",
  borderRadius: 999,
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

