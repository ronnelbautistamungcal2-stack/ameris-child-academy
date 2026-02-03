import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const c = await apiJson("/api/v1/centers");
      const arr = Array.isArray(c) ? c : [];
      setCenters(arr);
      if (arr.length === 1) setCenterId(arr[0].id);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadChecklists(id) {
    if (!id) {
      setChecklists([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const lists = await apiJson(
        `/api/v1/checklists?centerId=${encodeURIComponent(id)}`,
      );
      setChecklists(Array.isArray(lists) ? lists : []);
    } catch (e) {
      setError(e.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCenters();
  }, []);

  useEffect(() => {
    setSuccess("");
    loadChecklists(centerId);
  }, [centerId]);

  const sorted = useMemo(() => {
    return [...checklists].sort((a, b) =>
      (a.title || "").localeCompare(b.title || ""),
    );
  }, [checklists]);

  function parseTasks(text) {
    return (text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((t) => ({ title: t }));
  }

  async function createChecklist(e) {
    e.preventDefault();
    if (!centerId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/checklists", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          centerId,
          tasks: parseTasks(tasksText),
        }),
      });
      setTitle("");
      setDescription("");
      setTasksText("");
      setSuccess("Checklist created.");
      await loadChecklists(centerId);
    } catch (e2) {
      setError(e2.message || "Failed to create checklist");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id) {
    if (!confirm("Delete this checklist?")) return;
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/checklists/${id}`, { method: "DELETE" });
      await loadChecklists(centerId);
    } catch (e) {
      setError(e.message || "Failed to delete checklist");
    }
  }

  return (
    <AdminLayout title="Checklists">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Daily/Weekly Checklists</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Admin-managed checklists; tasks can link to policies/training media
          (links support is in the data model but the UI currently captures titles only).
        </p>

        {error ? <Banner kind="error" message={error} /> : null}
        {success ? <Banner kind="success" message={success} /> : null}

        <div style={{ marginTop: 12, maxWidth: 520 }}>
          <Field label="Center">
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <form onSubmit={createChecklist} style={{ marginTop: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Description (optional)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Tasks (one per line)">
              <textarea
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                style={{ ...inputStyle, minHeight: 120, fontFamily: "monospace" }}
                placeholder="Wash hands\nNap time check\nMeal prep"
              />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              type="submit"
              disabled={saving || !centerId}
              style={primaryButton}
            >
              {saving ? "Saving…" : "Create Checklist"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading…</p>
          ) : !centerId ? (
            <p style={{ color: "#6b7280" }}>Select a center to view checklists.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {sorted.map((cl) => (
                <div key={cl.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{cl.title}</div>
                      <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
                        {cl.description || "—"}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        {(cl.tasks || []).length ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {cl.tasks.slice(0, 8).map((t) => (
                              <li key={t.id}>{t.title}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ color: "#6b7280" }}>No tasks.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        style={dangerButton}
                        onClick={() => deleteChecklist(cl.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {sorted.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No checklists yet.</div>
              ) : null}
            </div>
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

function Banner({ message, kind }) {
  const style =
    kind === "success"
      ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }
      : { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  return <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...style }}>{message}</div>;
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxSizing: "border-box",
};

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButton = {
  padding: "10px 12px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

