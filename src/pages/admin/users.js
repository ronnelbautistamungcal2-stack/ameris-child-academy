import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("PARENT");
  const [centerId, setCenterId] = useState("");
  const [dob, setDob] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        apiJson("/api/v1/users"),
        apiJson("/api/v1/centers"),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users]);

  function resetForm() {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("PARENT");
    setCenterId("");
    setDob("");
    setHireDate("");
    setAboutMe("");
    setPictureUrl("");
  }

  function startEdit(user) {
    setEditing(user);
    setName(user.name || "");
    setEmail(user.email || "");
    setRole(user.role || "PARENT");
    setPassword("");
    setCenterId("");
    setDob(user.dob ? String(user.dob).slice(0, 10) : "");
    setHireDate(user.hireDate ? String(user.hireDate).slice(0, 10) : "");
    setAboutMe(user.aboutMe || "");
    setPictureUrl(user.pictureUrl || "");
  }

  async function createUser(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name || null,
          password,
          role,
          centerId: centerId || undefined,
          dob: dob || null,
          hireDate: hireDate || null,
          aboutMe: aboutMe || null,
          pictureUrl: pictureUrl || null,
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create user");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiJson(`/api/v1/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name || null,
          role,
          password: password || undefined,
          dob: dob || null,
          hireDate: hireDate || null,
          aboutMe: aboutMe || null,
          pictureUrl: pictureUrl || null,
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update user");
    }
  }

  async function deleteUser(id) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/users/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete user");
    }
  }

  return (
    <AdminLayout title="Users & Roles">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Users & Role-Based Access</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create/modify/delete users and set roles (ADMIN/TEACHER/PARENT/etc).
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={editing ? saveEdit : createUser} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required={!editing}
                disabled={!!editing}
              />
            </Field>
            <Field label={editing ? "New Password (optional)" : "Password"}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                type="password"
                required={!editing}
              />
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 10,
              marginTop: 10,
            }}
          >
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={editing ? "Assign Center (create only)" : "Assign Center"}>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                style={inputStyle}
                disabled={!!editing}
              >
                <option value="">(none)</option>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
            <Field label="DOB">
              <input
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={inputStyle}
                type="date"
              />
            </Field>
            <Field label="DOH">
              <input
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                style={inputStyle}
                type="date"
              />
            </Field>
            <Field label="Picture URL">
              <input
                value={pictureUrl}
                onChange={(e) => setPictureUrl(e.target.value)}
                style={inputStyle}
                placeholder="https://…"
              />
            </Field>
          </div>

          <div style={{ marginTop: 10 }}>
            <Field label="About Me">
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              />
            </Field>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.name || "—"}</td>
                    <td style={tdStyle}>
                      <code style={codePill}>{u.role}</code>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={secondaryButton} onClick={() => startEdit(u)}>
                          Edit
                        </button>
                        <button type="button" style={dangerButton} onClick={() => deleteUser(u.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={4}>
                      No users found.
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
