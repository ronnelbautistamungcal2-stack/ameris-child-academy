import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [centerId, setCenterId] = useState("");
  const [media, setMedia] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [l, c] = await Promise.all([apiJson("/api/v1/lessons"), apiJson("/api/v1/centers")]);
      setLessons(Array.isArray(l) ? l : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);

  const sorted = useMemo(() => {
    return [...lessons].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [lessons]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCenterId("");
    setMedia("");
  }

  function startEdit(lesson) {
    setEditing(lesson);
    setTitle(lesson.title || "");
    setDescription(lesson.description || "");
    setCenterId(lesson.centerId || "");
    setMedia(Array.isArray(lesson.media) ? lesson.media.join(", ") : "");
  }

  function parseMedia(value) {
    const items = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return items;
  }

  async function createLesson(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/v1/lessons", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          centerId,
          media: parseMedia(media),
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create lesson");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          description: description || null,
          media: parseMedia(media),
        }),
      });
      resetForm();
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update lesson");
    }
  }

  async function deleteLesson(id) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete lesson");
    }
  }

  return (
    <AdminLayout title="Lessons">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Lessons</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create/modify/delete lessons. Media is a comma-separated list of URLs/paths.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={editing ? saveEdit : createLesson} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginTop: 10 }}>
            <Field label="Description">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
                placeholder="Optional"
              />
            </Field>
            <Field label="Media (comma separated)">
              <input
                value={media}
                onChange={(e) => setMedia(e.target.value)}
                style={inputStyle}
                placeholder="/uploads/file.png, https://example.com/video.mp4"
              />
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
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Center</th>
                  <th style={thStyle}>Media</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => (
                  <tr key={l.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{l.title}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{l.description || "—"}</div>
                    </td>
                    <td style={tdStyle}>{centerById[l.centerId]?.name || l.centerId}</td>
                    <td style={tdStyle}>
                      {Array.isArray(l.media) && l.media.length ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {l.media.slice(0, 3).map((m) => (
                            <li key={m} style={{ fontSize: 12, color: "#374151" }}>
                              <code style={codePill}>{m}</code>
                            </li>
                          ))}
                          {l.media.length > 3 ? (
                            <li style={{ fontSize: 12, color: "#6b7280" }}>… +{l.media.length - 3} more</li>
                          ) : null}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={secondaryButton} onClick={() => startEdit(l)}>
                          Edit
                        </button>
                        <button type="button" style={dangerButton} onClick={() => deleteLesson(l.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={4}>
                      No lessons found.
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

