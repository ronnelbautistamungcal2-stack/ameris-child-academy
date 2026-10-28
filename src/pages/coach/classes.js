import CoachLayout from "@/components/coach/CoachLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { userRoles } from "@/lib/roles";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const listControl = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800";

export default function CoachClassroomList() {
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
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [expandedClassId, setExpandedClassId] = useState("");
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
      setTeachers(Array.isArray(t) ? t.filter((u) => userRoles(u).includes("TEACHER")) : []);
    } catch (e) {
      setError(e.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

  const sorted = useMemo(() => [...classes].sort((a, b) => (a.name || "").localeCompare(b.name || "")), [classes]);
  const ageRanges = useMemo(() => [...new Set(classes.map((c) => c.ageRange).filter(Boolean))].sort(), [classes]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((cl) => {
      const assigned = Array.isArray(cl.children) ? cl.children.length : 0;
      const full = cl.capacity != null && assigned >= cl.capacity;
      if (q && !`${cl.name} ${(cl.teachers || []).map((tc) => tc.teacher?.name || "").join(" ")}`.toLowerCase().includes(q)) return false;
      if (ageFilter && cl.ageRange !== ageFilter) return false;
      if (statusFilter === "FULL" && !full) return false;
      if (statusFilter === "OPEN" && full) return false;
      return true;
    });
  }, [sorted, search, ageFilter, statusFilter]);
  const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => (a.email || "").localeCompare(b.email || "")), [teachers]);

  const effectiveCenterId = editing?.centerId || centerId || "";

  const availableTeachers = useMemo(() => {
    if (!effectiveCenterId) return sortedTeachers;
    return sortedTeachers.filter((t) =>
      (t.centers || []).some((cu) => cu.role === "TEACHER" && cu.centerId === effectiveCenterId),
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
    setCapacity(cl.capacity === null || cl.capacity === undefined ? "" : String(cl.capacity));
    setAgeRange(cl.ageRange || "");
    setSelectedTeacherIds((cl.teachers || []).map((tc) => tc.teacherId).filter(Boolean));
  }, []);

  const openCreate = useCallback(() => { setError(""); resetForm(); setModalOpen(true); }, [resetForm]);
  const openEdit = useCallback((cl) => { setError(""); startEdit(cl); setModalOpen(true); }, [startEdit]);
  const closeModal = useCallback(() => { if (saving) return; setModalOpen(false); setError(""); resetForm(); }, [resetForm, saving]);

  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document?.body?.style?.overflow || "";
    document.body.style.overflow = "hidden";
    function onKeyDown(e) { if (e.key === "Escape") closeModal(); }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = prevOverflow; };
  }, [modalOpen, closeModal]);

  function parseCapacityInput(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) throw new Error("Capacity must be a whole number.");
    if (num < 0) throw new Error("Capacity must be >= 0.");
    return num;
  }

  function toggleTeacher(teacherId) {
    setSelectedTeacherIds((cur) => cur.includes(teacherId) ? cur.filter((id) => id !== teacherId) : [...cur, teacherId]);
    setTeacherQuery("");
    setTeacherDropdownOpen(false);
  }

  function uniqueIds(arr) { return [...new Set((arr || []).filter(Boolean))]; }

  const teacherSearchResults = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return availableTeachers;
    return availableTeachers.filter((t) => `${t.name || ""} ${t.email || ""}`.toLowerCase().includes(q));
  }, [availableTeachers, teacherQuery]);

  async function saveTeacherAssignmentsForClass({ classId, classCenterId, previousTeacherIds, nextTeacherIds }) {
    const prevSet = new Set(previousTeacherIds || []);
    const nextSet = new Set(nextTeacherIds || []);
    const impactedTeacherIds = uniqueIds([...(previousTeacherIds || []), ...(nextTeacherIds || [])]);

    await Promise.all(
      impactedTeacherIds.map(async (teacherId) => {
        const teacher = teacherById[teacherId];
        if (!teacher) return;
        const currentCenterIds = uniqueIds((teacher.centers || []).filter((cu) => cu.role === "TEACHER").map((cu) => cu.centerId));
        const currentClassIds = uniqueIds((teacher.teacherClasses || []).map((tc) => tc.classId));
        const shouldHaveClass = nextSet.has(teacherId);
        const hadClass = prevSet.has(teacherId);
        if (!shouldHaveClass && !hadClass) return;
        const nextClassIds = shouldHaveClass ? uniqueIds([...currentClassIds, classId]) : currentClassIds.filter((id) => id !== classId);
        const nextCenterIds = shouldHaveClass && classCenterId && !currentCenterIds.includes(classCenterId) ? uniqueIds([...currentCenterIds, classCenterId]) : currentCenterIds;
        await apiJson(`/api/v1/teachers/${teacherId}/assignments`, { method: "PUT", body: JSON.stringify({ centerIds: nextCenterIds, classIds: nextClassIds }) });
      }),
    );
  }

  async function createClass(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const parsedCapacity = parseCapacityInput(capacity);
      const created = await apiJson("/api/v1/classes", { method: "POST", body: JSON.stringify({ name, centerId, capacity: parsedCapacity, ageRange: ageRange || null }) });
      if (created?.id && selectedTeacherIds.length) {
        await saveTeacherAssignmentsForClass({ classId: created.id, classCenterId: centerId, previousTeacherIds: [], nextTeacherIds: selectedTeacherIds });
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
      await apiJson(`/api/v1/classes/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, capacity: parsedCapacity, ageRange: ageRange || null }) });
      const previousTeacherIds = (editing.teachers || []).map((tc) => tc.teacherId).filter(Boolean);
      await saveTeacherAssignmentsForClass({ classId: editing.id, classCenterId: editing.centerId, previousTeacherIds, nextTeacherIds: selectedTeacherIds });
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
    setError("");
    try {
      await apiJson(`/api/v1/classes/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      await refresh();
    } catch (e2) {
      setDeleteConfirmId(null);
      setError(e2.message || "Failed to delete class");
    }
  }

  return (
    <CoachLayout title="Classroom List">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-[#0b2a5b] dark:text-blue-100">Classroom List</h1>
        <button type="button" onClick={openCreate} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
          + Add Classroom
        </button>
      </div>

      <div>
        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {/* Modal */}
        {modalOpen && (
          <Modal title={editing ? `Edit — ${editing.name}` : "New Classroom"} onClose={closeModal}>
            {error && <ErrorBanner message={error} />}
            <form onSubmit={editing ? saveEdit : createClass}>
              <SectionHeader icon="📝" title="Details" />
              <div style={formGridStyle}>
                <FieldLabel label="Classroom Name *">
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required disabled={saving} placeholder="e.g. Butterfly Room" />
                </FieldLabel>
                <FieldLabel label={editing ? "Center (set at creation)" : "Center *"}>
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle} required={!editing} disabled={!!editing || saving}>
                    <option value="">{editing ? "(unchanged)" : "Select a center"}</option>
                    {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FieldLabel>
                <FieldLabel label="Capacity">
                  <input value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} inputMode="numeric" placeholder="e.g. 20" disabled={saving} />
                </FieldLabel>
                <FieldLabel label="Age Range">
                  <input value={ageRange} onChange={(e) => setAgeRange(e.target.value)} style={inputStyle} placeholder="e.g. 4-5 years" disabled={saving} />
                </FieldLabel>
              </div>

              {/* Teacher Assignment */}
              <SectionHeader icon="👩‍🏫" title="Assigned Teachers" style={{ marginTop: 20 }} />
              {!effectiveCenterId ? (
                <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Select a center first to assign teachers.</div>
              ) : availableTeachers.length === 0 ? (
                <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>No teachers found for this center.</div>
              ) : (
                <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 12 }}>
                  {/* Search */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      value={teacherQuery}
                      onChange={(e) => setTeacherQuery(e.target.value)}
                      onFocus={() => setTeacherDropdownOpen(true)}
                      onClick={() => setTeacherDropdownOpen(true)}
                      onBlur={() => setTeacherDropdownOpen(false)}
                      style={{ ...inputStyle, padding: "8px 10px", fontSize: 12 }}
                      placeholder="Search teachers..."
                      disabled={saving}
                    />
                    {selectedTeacherIds.length > 0 && (
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSelectedTeacherIds([])} disabled={saving}
                        style={{ padding: "6px 10px", border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)", color: "var(--admin-text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Dropdown */}
                  {teacherDropdownOpen && (
                    <div style={{ marginTop: 6, maxHeight: 140, overflow: "auto", border: "1px solid var(--admin-border)", borderRadius: 10, background: "var(--admin-bg)" }}>
                      {teacherSearchResults.map((t) => {
                        const active = selectedTeacherIds.includes(t.id);
                        return (
                          <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleTeacher(t.id)} disabled={saving}
                            style={{
                              width: "100%", textAlign: "left", padding: "8px 12px",
                              border: "none", borderBottom: "1px solid var(--admin-border-light, #F3F4F6)",
                              background: active ? "#EFF6FF" : "var(--admin-bg)",
                              color: "var(--admin-text)", cursor: "pointer", fontSize: 13,
                              display: "flex", alignItems: "center", gap: 8,
                            }}>
                            <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${active ? "#2563eb" : "var(--admin-border)"}`, background: active ? "#2563eb" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                              {active ? "✓" : ""}
                            </span>
                            <span style={{ fontWeight: active ? 700 : 500 }}>{t.name || t.email}</span>
                          </button>
                        );
                      })}
                      {teacherSearchResults.length === 0 && (
                        <div style={{ padding: 10, color: "var(--admin-text-muted)", fontSize: 12 }}>No results</div>
                      )}
                    </div>
                  )}

                  {/* Selected chips */}
                  {selectedTeacherIds.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedTeacherIds.map((id) => {
                        const t = teacherById[id];
                        return (
                          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "#DBEAFE", color: "#1E40AF", fontSize: 11, fontWeight: 700 }}>
                            {t?.name || t?.email || id}
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleTeacher(id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#1E40AF", fontWeight: 800, fontSize: 12, padding: 0, lineHeight: 1 }}>
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {selectedTeacherIds.length === 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-text-muted)" }}>No teachers selected.</div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--admin-border)" }}>
                <button type="button" style={secondaryBtnStyle} onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" style={primaryBtnStyle} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Classroom"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Classroom List (client mockup 10-01) */}
        <div className="mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classrooms..." aria-label="Search classrooms" className={listControl} />
          <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} aria-label="Age group" className={listControl}>
            <option value="">All Age Groups</option>
            {ageRanges.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className={listControl}>
            <option value="">All Statuses</option>
            <option value="OPEN">Has Openings</option>
            <option value="FULL">Full</option>
          </select>
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <tr>
                  {["Classroom Name", "Age Range", "Capacity", "Assigned", "Teachers", "Actions"].map((h) => (
                    <th key={h} className={`px-4 py-3 font-bold ${["Capacity", "Assigned", "Actions"].includes(h) ? "text-center" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visible.map((cl) => {
                  const teacherNames = (cl.teachers || []).map((tc) => tc.teacher?.name || tc.teacher?.email || tc.teacherId);
                  const assigned = Array.isArray(cl.children) ? cl.children.length : 0;
                  const open = expandedClassId === cl.id;
                  return (
                    <Fragment key={cl.id}>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#0b2a5b] dark:text-blue-100">{cl.name}</div>
                          {centers.length > 1 ? <div className="text-xs text-gray-500">{centerById[cl.centerId]?.name}</div> : null}
                        </td>
                        <td className="px-4 py-3">{cl.ageRange || "—"}</td>
                        <td className="px-4 py-3 text-center">{cl.capacity ?? "—"}</td>
                        <td className={`px-4 py-3 text-center ${cl.capacity != null && assigned >= cl.capacity ? "font-bold text-red-600" : ""}`}>{assigned}</td>
                        <td className="px-4 py-3">{teacherNames.join(", ") || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setExpandedClassId(open ? "" : cl.id)} aria-expanded={open} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-[#0b2a5b] hover:bg-gray-50 dark:text-blue-100">
                              {open ? "Hide Roster" : "View Roster"}
                            </button>
                            <button type="button" onClick={() => openEdit(cl)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-[#0b2a5b] hover:bg-gray-50 dark:text-blue-100">✎ Edit</button>
                            <button type="button" onClick={() => setDeleteConfirmId(cl.id)} aria-label={`Delete ${cl.name}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100">🗑</button>
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={6} className="bg-blue-50/50 px-6 py-3 dark:bg-gray-800">
                            <div className="text-xs font-bold uppercase text-gray-500">Roster ({assigned})</div>
                            {assigned ? (
                              <ul className="mt-2 grid gap-1 sm:grid-cols-3">
                                {cl.children.map((child) => (
                                  <li key={child.id} className="text-sm">
                                    <span className="font-semibold">{[child.firstName, child.lastName].filter(Boolean).join(" ") || "Unnamed child"}</span>
                                    {child.birthDate ? <span className="ml-2 text-xs text-gray-500">DOB {new Date(child.birthDate).toLocaleDateString()}</span> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-sm text-gray-500">No children assigned yet.</p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {!visible.length ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{sorted.length ? "No classrooms match these filters." : "No classrooms yet. Use Add Classroom to create one."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {!loading && sorted.length ? <p className="mt-3 text-sm text-gray-500">Showing {visible.length} of {sorted.length} classrooms</p> : null}

        <ConfirmDialog
          open={!!deleteConfirmId}
          title="Delete Classroom"
          message="Are you sure you want to delete this classroom? This action cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteClass(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      </div>
    </CoachLayout>
  );
}

/* ── Sub-components ── */

function SectionHeader({ icon, title, style: extraStyle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, ...extraStyle }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--admin-text)" }}>{title}</span>
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" style={modalOverlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalCardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--admin-border)" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--admin-text)" }}>{title}</div>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-muted)" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, marginTop: 12, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600 }}>
      {message}
    </div>
  );
}

/* ── Styles ── */

const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
  borderRadius: 10, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)", fontSize: 13,
};

const fieldLabelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)", marginBottom: 6 };

const primaryBtnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)", color: "white",
  border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
};

const secondaryBtnStyle = {
  padding: "10px 16px", background: "var(--admin-bg)", color: "var(--admin-text)",
  border: "1px solid var(--admin-border)", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
};

const modalOverlayStyle = {
  position: "fixed", inset: 0, zIndex: 80, background: "var(--admin-modal-overlay, rgba(0,0,0,0.5))",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};

const modalCardStyle = {
  width: "min(980px, 100%)", maxHeight: "min(88vh, 920px)", overflow: "auto",
  background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
  borderRadius: 16, padding: 24, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
};
