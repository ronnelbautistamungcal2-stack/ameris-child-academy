import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
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

  const [roleTab, setRoleTab] = useState("ALL");

  const sorted = useMemo(() => {
    const filtered = roleTab === "ALL" ? users : users.filter((u) => u.role === roleTab);
    return [...filtered].sort((a, b) =>
      (a.email || "").localeCompare(b.email || ""),
    );
  }, [users, roleTab]);

  const roleCounts = useMemo(() => {
    const counts = { ALL: users.length };
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1;
    }
    return counts;
  }, [users]);

  const resetForm = useCallback(() => {
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
  }, []);

  const startEdit = useCallback((user) => {
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
  }, []);

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (user) => {
      setError("");
      startEdit(user);
      setModalOpen(true);
    },
    [startEdit],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError("");
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!modalOpen) return;

    const prevOverflow = document?.body?.style?.overflow || "";
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, closeModal]);

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
      setModalOpen(false);
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
      setModalOpen(false);
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
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0 }}>Users & Role-Based Access</h2>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Create/modify/delete users and set roles (ADMIN/TEACHER/PARENT/etc).
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={openCreate}>
            + Add User
          </button>
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {modalOpen ? (
          <Modal
            title={editing ? "Edit User" : "Add User"}
            onClose={closeModal}
          >
            {error ? <ErrorBanner message={error} /> : null}
            <form onSubmit={editing ? saveEdit : createUser}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
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
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
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
          
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={inputStyle}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={editing ? "Assign Center (create only)" : "Assign Center"}
            >
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
              <button type="button" style={secondaryButton} onClick={resetForm}>
                Clear
              </button>
              <button type="button" style={secondaryButton} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" style={primaryButton}>
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
            </form>
          </Modal>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <div style={tabBarStyle}>
            {[
              { key: "ALL", label: "All" },
              { key: "TEACHER", label: "Teachers" },
              { key: "PARENT", label: "Parents" },
              { key: "ADMIN", label: "Admins" },
              { key: "COACH", label: "Coaches" },
              { key: "SUBSCRIBER", label: "Subscribers" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setRoleTab(t.key)}
                style={roleTab === t.key ? activeTabStyle : inactiveTabStyle}
              >
                {t.label}
                {roleCounts[t.key] ? (
                  <span style={tabCountStyle}>{roleCounts[t.key]}</span>
                ) : null}
              </button>
            ))}
          </div>

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
                    <td style={tdStyle}>
                      {u.role === "TEACHER" ? (
                        <Link href={`/admin/teachers/${encodeURIComponent(u.id)}`} style={teacherLink}>
                          {u.name || "—"}
                        </Link>
                      ) : (
                        u.name || "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      <code style={codePill}>{u.role}</code>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={secondaryButton}
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={dangerButton}
                          onClick={() => deleteUser(u.id)}
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

function Modal({ title, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modalOverlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalCardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button type="button" style={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
        {label}
      </div>
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

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(17, 24, 39, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCardStyle = {
  width: "min(980px, 100%)",
  maxHeight: "min(86vh, 900px)",
  overflow: "auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow:
    "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.12)",
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

const teacherLink = {
  color: "#2563eb",
  fontWeight: 600,
  textDecoration: "none",
};

const tabBarStyle = {
  display: "flex",
  gap: 0,
  borderBottom: "2px solid #e5e7eb",
  marginBottom: 16,
  overflowX: "auto",
};

const activeTabStyle = {
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 700,
  color: "#2563eb",
  background: "none",
  border: "none",
  borderBottom: "2px solid #2563eb",
  marginBottom: -2,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const inactiveTabStyle = {
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "#6b7280",
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  marginBottom: -2,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const tabCountStyle = {
  background: "#f3f4f6",
  color: "#374151",
  padding: "1px 7px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};
