import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);
  const [expandedLessonId, setExpandedLessonId] = useState("");

  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (!centerId && arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLessons(nextCenterId) {
    if (!nextCenterId) {
      setLessons([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const l = await apiJson(
        `/api/v1/lessons?centerId=${encodeURIComponent(nextCenterId)}`,
      );
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery("");
    setVisibleCount(100);
    setExpandedLessonId("");
    loadLessons(centerId);
  }, [centerId]);

  const centerById = useMemo(
    () => Object.fromEntries(centers.map((c) => [c.id, c])),
    [centers],
  );

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const base = Array.isArray(lessons) ? lessons : [];
    const filtered = base.filter((l) => {
      if (!q) return true;
      const haystack = [l?.title, l?.description, l?.category?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return filtered.sort((a, b) => byString(a.title, b.title));
  }, [lessons, query]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setMedia("");
  }

  function startEdit(lesson) {
    setEditing(lesson);
    setTitle(lesson.title || "");
    setDescription(lesson.description || "");
    setMedia(Array.isArray(lesson.media) ? lesson.media.join(", ") : "");
  }

  function parseMedia(value) {
    return String(value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function importStepsLibrary() {
    if (!centerId) {
      setError("Select a center, then run import.");
      return;
    }
    if (
      !confirm(
        "Import Steps of Progression Library into this center? This may add many lessons/goals.",
      )
    ) {
      return;
    }

    setImporting(true);
    setImportResult(null);
    setError("");
    try {
      const result = await apiJson("/api/v1/import/steps-library", {
        method: "POST",
        body: JSON.stringify({ centerId }),
      });
      setImportResult(result);
      await loadLessons(centerId);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function normalizeCategories() {
    if (!centerId) {
      setError("Select a center first.");
      return;
    }
    if (
      !confirm(
        "Normalize lesson categories for this center? This will merge duplicates (ex: 'development' -> 'Development').",
      )
    ) {
      return;
    }

    setImporting(true);
    setImportResult(null);
    setError("");
    try {
      const result = await apiJson("/api/v1/lessons/normalize-categories", {
        method: "POST",
        body: JSON.stringify({ centerId }),
      });
      setImportResult(result);
      await loadLessons(centerId);
    } catch (e) {
      setError(e.message || "Normalization failed");
    } finally {
      setImporting(false);
    }
  }

  async function createLesson(e) {
    e.preventDefault();
    if (!centerId) {
      setError("Select a center first.");
      return;
    }
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
      await loadLessons(centerId);
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
      await loadLessons(centerId);
    } catch (e2) {
      setError(e2.message || "Failed to update lesson");
    }
  }

  async function deleteLesson(id) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${id}`, { method: "DELETE" });
      await loadLessons(centerId);
    } catch (e2) {
      setError(e2.message || "Failed to delete lesson");
    }
  }

  return (
    <AdminLayout title="Lessons">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Lessons</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create/modify lessons, view lesson guides (steps/testing questions),
          and import the Steps of Progression library.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Center">
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              <option value="">Select a center</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Search lessons">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(100);
              }}
              style={inputStyle}
              placeholder="Title, description, category…"
              disabled={!centerId}
            />
          </Field>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            style={primaryButton}
            onClick={importStepsLibrary}
            disabled={importing || !centerId}
          >
            {importing ? "Importing…" : "Import Steps Library"}
          </button>
          <button
            type="button"
            style={secondaryButton}
            onClick={normalizeCategories}
            disabled={importing || !centerId}
          >
            {importing ? "Working…" : "Normalize Categories"}
          </button>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Uses <code style={codePill}>public/uploads/StepsofProgressionLibrary.xlsx</code>
          </div>
        </div>

        {importResult ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontSize: 12,
              color: "#111827",
            }}
          >
            {"rowsImported" in importResult ? (
              <>
                Imported {importResult.rowsImported || 0} rows (
                {importResult.goalsCreated || 0} new steps,{" "}
                {importResult.lessonsCreated || 0} new lessons,{" "}
                {importResult.categoriesCreated || 0} new categories).
              </>
            ) : (
              <>
                Normalized categories: {importResult.categoriesRenamed || 0} renamed,{" "}
                {importResult.categoriesDeleted || 0} merged/removed,{" "}
                {importResult.lessonsReassigned || 0} lessons reassigned.
              </>
            )}
          </div>
        ) : null}

        <form onSubmit={editing ? saveEdit : createLesson} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />
            </Field>
            <Field label={editing ? "Center (view only)" : "Center"}>
              <input
                value={centerById[centerId]?.name || centerId || ""}
                style={{ ...inputStyle, background: "#f9fafb" }}
                disabled
                placeholder={editing ? "(unchanged)" : "Select a center above"}
              />
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
              <button type="submit" style={primaryButton} disabled={!centerId && !editing}>
                {editing ? "Save" : "Create"}
              </button>
              <button type="button" style={secondaryButton} onClick={resetForm}>
                Clear
              </button>
            </div>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {!centerId ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>Select a center to view lessons.</div>
          ) : loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} lessons.
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Title / Guide</th>
                    <th style={thStyle}>Media</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visibleCount).map((l) => {
                    const goals = Array.isArray(l.goals) ? l.goals : [];
                    const expanded = expandedLessonId === l.id;
                    return (
                      <tr key={l.id}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700 }}>{l.title}</div>
                              <div style={{ color: "#6b7280", fontSize: 12 }}>
                                {(l?.category?.name || "Uncategorized") +
                                  (goals.length ? ` • ${goals.length} steps` : "")}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 12 }}>{l.description || "—"}</div>
                            </div>
                            <button
                              type="button"
                              style={secondaryButton}
                              onClick={() => setExpandedLessonId(expanded ? "" : l.id)}
                            >
                              {expanded ? "Hide guide" : "View guide"}
                            </button>
                          </div>

                          {expanded ? (
                            <div style={{ marginTop: 10, padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
                              {goals.length ? (
                                <div style={{ display: "grid", gap: 8 }}>
                                  {goals
                                    .slice()
                                    .sort((a, b) => Number(a.goalIndex || 0) - Number(b.goalIndex || 0))
                                    .slice(0, 10)
                                    .map((g) => (
                                      <div key={g.id || `${l.id}:${g.goalIndex}`} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
                                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                                          Step {g.goalIndex}: {g.title}
                                        </div>
                                        {g.description ? (
                                          <div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 12, color: "#111827" }}>
                                            {g.description}
                                          </div>
                                        ) : (
                                          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>No testing question.</div>
                                        )}
                                      </div>
                                    ))}
                                  {goals.length > 10 ? (
                                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                                      Showing first 10 steps. Use the Teacher Lessons page for full guide.
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No steps added yet.</div>
                              )}
                            </div>
                          ) : null}
                        </td>

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
                    );
                  })}

                  {filtered.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={3}>
                        No lessons found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              {filtered.length > visibleCount ? (
                <button
                  type="button"
                  style={{ ...secondaryButton, marginTop: 10 }}
                  onClick={() => setVisibleCount((n) => n + 100)}
                >
                  Load 100 more
                </button>
              ) : null}
            </>
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
