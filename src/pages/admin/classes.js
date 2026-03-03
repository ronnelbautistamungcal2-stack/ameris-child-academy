import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [centers, setCenters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [centerId, setCenterId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [cls, c, t] = await Promise.all([
        apiJson("/api/v1/classes"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/teachers"),
      ]);
      setClasses(Array.isArray(cls) ? cls : []);
      setCenters(Array.isArray(c) ? c : []);
      setTeachers(Array.isArray(t) ? t : []);
    } catch (e) {
      setError(e.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const centerById = useMemo(
    () => Object.fromEntries(centers.map((c) => [c.id, c])),
    [centers],
  );

  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t])),
    [teachers],
  );

  const sorted = useMemo(() => {
    return [...classes].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [classes]);

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) =>
      (a.email || "").localeCompare(b.email || ""),
    );
  }, [teachers]);

  const effectiveCenterId = editing?.centerId || centerId || "";

  const availableTeachers = useMemo(() => {
    if (!effectiveCenterId) return sortedTeachers;
    return sortedTeachers.filter((t) =>
      (t.centers || []).some(
        (cu) => cu.role === "TEACHER" && cu.centerId === effectiveCenterId,
      ),
    );
  }, [effectiveCenterId, sortedTeachers]);

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setCenterId("");
    setCapacity("");
    setAgeRange("");
    setSelectedTeacherIds([]);
    setTeacherQuery("");
    setTeacherDropdownOpen(false);
  }, []);

  const startEdit = useCallback((cl) => {
    setEditing(cl);
    setName(cl.name || "");
    setCenterId(cl.centerId || "");
    setCapacity(
      cl.capacity === null || cl.capacity === undefined
        ? ""
        : String(cl.capacity),
    );
    setAgeRange(cl.ageRange || "");
    setSelectedTeacherIds(
      (cl.teachers || []).map((tc) => tc.teacherId).filter(Boolean),
    );
  }, []);

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (cl) => {
      setError("");
      startEdit(cl);
      setModalOpen(true);
    },
    [startEdit],
  );

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setError("");
    resetForm();
  }, [resetForm, saving]);

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

  function parseCapacityInput(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new Error("Capacity must be a whole number.");
    }
    if (num < 0) throw new Error("Capacity must be >= 0.");
    return num;
  }

  function toggleTeacher(teacherId) {
    setSelectedTeacherIds((cur) =>
      cur.includes(teacherId)
        ? cur.filter((id) => id !== teacherId)
        : [...cur, teacherId],
    );
    setTeacherQuery("");
    setTeacherDropdownOpen(false);
  }

  function uniqueIds(arr) {
    return [...new Set((arr || []).filter(Boolean))];
  }

  const teacherSearchResults = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return availableTeachers;
    return availableTeachers.filter((t) => {
      const hay = `${t.name || ""} ${t.email || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableTeachers, teacherQuery]);

  const selectedTeacherSummary = useMemo(() => {
    if (!selectedTeacherIds.length) return "No teachers selected.";
    const names = selectedTeacherIds
      .map((id) => teacherById[id]?.name || teacherById[id]?.email)
      .filter(Boolean);
    if (!names.length) return "No teachers selected.";
    if (names.length <= 3) return `Selected (${names.length}): ${names.join(", ")}`;
    return `Selected (${names.length}): ${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
  }, [selectedTeacherIds, teacherById]);

  async function saveTeacherAssignmentsForClass({
    classId,
    classCenterId,
    previousTeacherIds,
    nextTeacherIds,
  }) {
    const prevSet = new Set(previousTeacherIds || []);
    const nextSet = new Set(nextTeacherIds || []);
    const impactedTeacherIds = uniqueIds([
      ...(previousTeacherIds || []),
      ...(nextTeacherIds || []),
    ]);

    await Promise.all(
      impactedTeacherIds.map(async (teacherId) => {
        const teacher = teacherById[teacherId];
        if (!teacher) return;

        const currentCenterIds = uniqueIds(
          (teacher.centers || [])
            .filter((cu) => cu.role === "TEACHER")
            .map((cu) => cu.centerId),
        );
        const currentClassIds = uniqueIds(
          (teacher.teacherClasses || []).map((tc) => tc.classId),
        );

        const shouldHaveClass = nextSet.has(teacherId);
        const hadClass = prevSet.has(teacherId);
        if (!shouldHaveClass && !hadClass) return;

        const nextClassIds = shouldHaveClass
          ? uniqueIds([...currentClassIds, classId])
          : currentClassIds.filter((id) => id !== classId);

        const nextCenterIds =
          shouldHaveClass &&
          classCenterId &&
          !currentCenterIds.includes(classCenterId)
            ? uniqueIds([...currentCenterIds, classCenterId])
            : currentCenterIds;

        await apiJson(`/api/v1/teachers/${teacherId}/assignments`, {
          method: "PUT",
          body: JSON.stringify({
            centerIds: nextCenterIds,
            classIds: nextClassIds,
          }),
        });
      }),
    );
  }

  async function createClass(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const parsedCapacity = parseCapacityInput(capacity);
      const created = await apiJson("/api/v1/classes", {
        method: "POST",
        body: JSON.stringify({
          name,
          centerId,
          capacity: parsedCapacity,
          ageRange: ageRange ? ageRange : null,
        }),
      });

      if (created?.id && selectedTeacherIds.length) {
        await saveTeacherAssignmentsForClass({
          classId: created.id,
          classCenterId: centerId,
          previousTeacherIds: [],
          nextTeacherIds: selectedTeacherIds,
        });
      }

      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create class");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      const parsedCapacity = parseCapacityInput(capacity);
      await apiJson(`/api/v1/classes/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          capacity: parsedCapacity,
          ageRange: ageRange ? ageRange : null,
        }),
      });

      const previousTeacherIds = (editing.teachers || [])
        .map((tc) => tc.teacherId)
        .filter(Boolean);

      await saveTeacherAssignmentsForClass({
        classId: editing.id,
        classCenterId: editing.centerId,
        previousTeacherIds,
        nextTeacherIds: selectedTeacherIds,
      });

      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update class");
    } finally {
      setSaving(false);
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
            <h2 style={{ marginTop: 0 }}>Classes</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 6 }}>
              Classroom setup: create/modify/delete class rooms.
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={openCreate}>
            + Add Room
          </button>
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {modalOpen ? (
          <Modal
            title={editing ? "Edit Room" : "Add Room"}
            onClose={closeModal}
          >
            {error ? <ErrorBanner message={error} /> : null}
            <form onSubmit={editing ? saveEdit : createClass}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <Field label="Class Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    required
                    disabled={saving}
                  />
                </Field>
                <Field label={editing ? "Center (create only)" : "Center"}>
                  <select
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value)}
                    style={inputStyle}
                    required={!editing}
                    disabled={!!editing || saving}
                  >
                    <option value="">
                      {editing ? "(unchanged)" : "Select a center"}
                    </option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Capacity">
                  <input
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    style={inputStyle}
                    inputMode="numeric"
                    placeholder="e.g. 20"
                    disabled={saving}
                  />
                </Field>
                <Field label="Age Range">
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  >
                    <option value="">Select age range</option>
                    <option value="0-1 years">0-1 years</option>
                    <option value="2-3 years">2-3 years</option>
                    <option value="4-5 years">4-5 years</option>
                    <option value="6-7 years">6-7 years</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="Assigned Teachers">
                  {!effectiveCenterId ? (
                    <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
                      Select a center first to assign teachers.
                    </div>
                  ) : availableTeachers.length === 0 ? (
                    <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
                      No teachers found for this center.
                    </div>
                  ) : (
                    <div style={teacherPickerWrapStyle}>
                      <div style={teacherInputRowStyle}>
                        <input
                          value={teacherQuery}
                          onChange={(e) => setTeacherQuery(e.target.value)}
                          onFocus={() => setTeacherDropdownOpen(true)}
                          onClick={() => setTeacherDropdownOpen(true)}
                          onBlur={() => setTeacherDropdownOpen(false)}
                          style={compactInputStyle}
                          placeholder="Search teacher..."
                          disabled={saving}
                        />
                        {selectedTeacherIds.length ? (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setSelectedTeacherIds([])}
                            disabled={saving}
                            style={tinyClearButtonStyle}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {teacherDropdownOpen ? (
                        <div style={teacherDropdownStyle}>
                          {teacherSearchResults.map((t) => {
                            const active = selectedTeacherIds.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => toggleTeacher(t.id)}
                                disabled={saving}
                                style={teacherOptionStyle(active)}
                              >
                                <span style={{ fontWeight: active ? 700 : 500 }}>
                                  {active ? "✓ " : ""}{t.name || t.email}
                                </span>
                              </button>
                            );
                          })}
                          {teacherSearchResults.length === 0 ? (
                            <div style={{ padding: 8, color: "var(--admin-text-muted)", fontSize: 12 }}>
                              No results
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div style={teacherSummaryStyle}>
                        {selectedTeacherSummary}
                      </div>
                    </div>
                  )}
                </Field>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={resetForm}
                  disabled={saving}
                >
                  Clear
                </button>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" style={primaryButton} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </Modal>
        ) : null}

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Center</th>
                  <th style={thStyle}>Capacity</th>
                  <th style={thStyle}>Age Range</th>
                  <th style={thStyle}>Teachers</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cl) => (
                  <tr key={cl.id}>
                    <td style={tdStyle}>{cl.name}</td>
                    <td style={tdStyle}>
                      {centerById[cl.centerId]?.name || cl.centerId}
                    </td>
                    <td style={tdStyle}>
                      {cl.capacity === null || cl.capacity === undefined
                        ? "-"
                        : cl.capacity}
                    </td>
                    <td style={tdStyle}>{cl.ageRange || "-"}</td>
                    <td style={tdStyle}>
                      {(cl.teachers || [])
                        .map(
                          (tc) =>
                            tc.teacher?.name || tc.teacher?.email || tc.teacherId,
                        )
                        .join(", ") || "-"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={secondaryButton}
                          onClick={() => openEdit(cl)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={dangerButton}
                          onClick={() => deleteClass(cl.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={6}>
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
    <div
      style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
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
      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 6 }}>
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
        background: "var(--admin-error-bg)",
        color: "var(--admin-error-text)",
        borderRadius: 8,
        marginTop: 12,
        border: "1px solid var(--admin-error-border)",
      }}
    >
      {message}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  overflow: "hidden",
};

const thStyle = {
  textAlign: "left",
  fontSize: 12,
  color: "var(--admin-text-muted)",
  padding: 10,
  borderBottom: "1px solid var(--admin-border)",
  background: "var(--admin-bg-secondary)",
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid var(--admin-border-light)",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "var(--admin-modal-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCardStyle = {
  width: "min(980px, 100%)",
  maxHeight: "min(86vh, 900px)",
  overflow: "auto",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 12,
  padding: 16,
  boxShadow:
    "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.12)",
};

const teacherDropdownStyle = {
  marginTop: 4,
  maxHeight: 120,
  overflow: "auto",
  border: "1px solid var(--admin-border)",
  borderRadius: 6,
  background: "var(--admin-bg)",
};

function teacherOptionStyle(active) {
  return {
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    border: "none",
    borderBottom: "1px solid var(--admin-border-light)",
    background: active ? "var(--admin-accent-bg)" : "var(--admin-bg)",
    color: "var(--admin-text)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  };
}

const teacherPickerWrapStyle = {
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  padding: 8,
};

const teacherInputRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const teacherSummaryStyle = {
  marginTop: 6,
  color: "var(--admin-text-muted)",
  fontSize: 12,
  lineHeight: 1.35,
};

const tinyClearButtonStyle = {
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  color: "var(--admin-text-secondary)",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const compactInputStyle = {
  ...inputStyle,
  padding: "6px 8px",
  borderRadius: 6,
  fontSize: 12,
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
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
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
