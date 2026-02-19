import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedCenterIds, setSelectedCenterIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [t, c, cls] = await Promise.all([
        apiJson("/api/v1/teachers"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
      ]);
      setTeachers(Array.isArray(t) ? t : []);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
    } catch (e) {
      setError(e.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const teacherById = useMemo(() => {
    return Object.fromEntries(teachers.map((t) => [t.id, t]));
  }, [teachers]);

  const selectedTeacher = selectedTeacherId ? teacherById[selectedTeacherId] : null;

  useEffect(() => {
    if (!selectedTeacher) {
      setSelectedCenterIds([]);
      setSelectedClassIds([]);
      return;
    }

    const teacherCenters = (selectedTeacher.centers || [])
      .filter((cu) => cu.role === "TEACHER")
      .map((cu) => cu.centerId);

    const teacherClasses = (selectedTeacher.teacherClasses || []).map((tc) => tc.classId);

    setSelectedCenterIds(teacherCenters);
    setSelectedClassIds(teacherClasses);
  }, [selectedTeacherId]);

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [teachers]);

  const availableClasses = useMemo(() => {
    if (!selectedCenterIds.length) return classes;
    const set = new Set(selectedCenterIds);
    return classes.filter((c) => set.has(c.centerId));
  }, [classes, selectedCenterIds]);

  function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function saveAssignments() {
    if (!selectedTeacher) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/teachers/${selectedTeacher.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({
          centerIds: selectedCenterIds,
          classIds: selectedClassIds,
        }),
      });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Teachers">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16 }}>
        <Panel>
          <h2 style={{ marginTop: 0 }}>Teachers</h2>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Assign teachers to centers and classrooms to enforce access limits.
          </p>

          {error ? <ErrorBanner message={error} /> : null}

          {loading ? (
            <p>Loading…</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Assigned Centers</th>
                  <th style={thStyle}>Assigned Classes</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeachers.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      background: selectedTeacherId === t.id ? "#eff6ff" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedTeacherId(t.id)}
                  >
                    <td style={tdStyle}>{t.email}</td>
                    <td style={tdStyle}>{t.name || "—"}</td>
                    <td style={tdStyle}>
                      {(t.centers || [])
                        .filter((cu) => cu.role === "TEACHER")
                        .map((cu) => cu.center?.name || cu.centerId)
                        .join(", ") || "—"}
                    </td>
                    <td style={tdStyle}>
                      {(t.teacherClasses || [])
                        .map((tc) => tc.classRoom?.name || tc.classId)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
                {sortedTeachers.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={4}>
                      No teachers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel>
          <h3 style={{ marginTop: 0 }}>Assignments</h3>
          {!selectedTeacher ? (
            <p style={{ color: "#6b7280" }}>Select a teacher to edit assignments.</p>
          ) : (
            <>
              <div style={{ marginTop: 6, color: "#111827", fontWeight: 700 }}>
                {selectedTeacher.email}
              </div>
              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
                These assignments control which centers/classrooms a teacher can access.
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={sectionLabel}>Centers</div>
                <div style={chipWrap}>
                  {centers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      style={chip(selectedCenterIds.includes(c.id))}
                      onClick={() => setSelectedCenterIds((cur) => toggleInList(cur, c.id))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={sectionLabel}>Classrooms</div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                  Filtered to selected centers when centers are selected.
                </div>
                <div style={chipWrap}>
                  {availableClasses.map((cl) => (
                    <button
                      key={cl.id}
                      type="button"
                      style={chip(selectedClassIds.includes(cl.id))}
                      onClick={() => setSelectedClassIds((cur) => toggleInList(cur, cl.id))}
                    >
                      {cl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" style={primaryButton} disabled={saving} onClick={saveAssignments}>
                  {saving ? "Saving…" : "Save Assignments"}
                </button>
                <button
                  type="button"
                  style={secondaryButton}
                  disabled={saving}
                  onClick={() => setSelectedTeacherId("")}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>
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

const sectionLabel = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const chipWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
};

function chip(active) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
    background: active ? "#eff6ff" : "white",
    cursor: "pointer",
    fontWeight: 700,
    color: "#111827",
  };
}

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButton = {
  padding: "10px 12px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

