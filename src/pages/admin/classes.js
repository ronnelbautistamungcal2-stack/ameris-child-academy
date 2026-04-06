import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
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
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [expandedClassId, setExpandedClassId] = useState("");

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

  useEffect(() => { refresh(); }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

  const sorted = useMemo(() => [...classes].sort((a, b) => (a.name || "").localeCompare(b.name || "")), [classes]);
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

  const AGE_COLORS = {
    "0-1 years": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
    "2-3 years": { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
    "4-5 years": { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
    "6-7 years": { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  };

  return (
    <AdminLayout title="Classes">
      {/* Stats */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon="🏫" label="Total Classrooms" value={classes.length} color="#2563eb" bg="#DBEAFE" />
          <StatCard icon="👥" label="Total Capacity" value={classes.reduce((s, c) => s + (c.capacity || 0), 0)} color="#059669" bg="#D1FAE5" />
          <StatCard icon="🏢" label="Centers" value={centers.length} color="#7C3AED" bg="#EDE9FE" />
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Classrooms</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13 }}>
              Create and manage classrooms, assign teachers, and set capacity limits.
            </p>
          </div>
          <button type="button" style={primaryBtnStyle} onClick={openCreate}>
            <span style={{ fontSize: 16 }}>+</span> Add Classroom
          </button>
        </div>

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
                  <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} style={inputStyle} disabled={saving}>
                    <option value="">Select age range</option>
                    <option value="0-1 years">0-1 years</option>
                    <option value="2-3 years">2-3 years</option>
                    <option value="4-5 years">4-5 years</option>
                    <option value="6-7 years">6-7 years</option>
                  </select>
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

        {/* Classrooms List */}
        <div style={{ marginTop: 20 }}>
          {loading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto" }}>🏫</div>
              <p style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>No classrooms yet</p>
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>Create your first classroom to get started.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sorted.map((cl) => {
                const centerName = centerById[cl.centerId]?.name || cl.centerId;
                const teacherNames = (cl.teachers || []).map((tc) => tc.teacher?.name || tc.teacher?.email || tc.teacherId);
                const ageColor = AGE_COLORS[cl.ageRange] || null;

                return (
                  <div
                    key={cl.id}
                    style={{ ...cardStyle, flexWrap: "wrap" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      🏠
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>{cl.name}</span>
                        {ageColor && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: ageColor.bg, color: ageColor.text, border: `1px solid ${ageColor.border}` }}>
                            {cl.ageRange}
                          </span>
                        )}
                        {cl.capacity != null && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>
                            Cap: {cl.capacity}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--admin-text-muted)", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
                          {centerName}
                        </span>
                        {teacherNames.length > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            👩‍🏫 {teacherNames.length <= 2 ? teacherNames.join(", ") : `${teacherNames.slice(0, 2).join(", ")} +${teacherNames.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" style={cardActionBtn} onClick={() => setExpandedClassId(expandedClassId === cl.id ? "" : cl.id)}>
                        {expandedClassId === cl.id ? "Hide Roster" : "View Roster"}
                      </button>
                      <button type="button" style={cardActionBtn} onClick={() => openEdit(cl)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button type="button" style={cardDangerBtn} onClick={() => setDeleteConfirmId(cl.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>

                    {expandedClassId === cl.id && (
                      <div style={{ marginTop: 16, display: "grid", gap: 12, flexBasis: "100%", width: "100%", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                        <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, background: "var(--admin-bg-secondary)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>
                            Assigned Teachers
                          </div>
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {teacherNames.length ? teacherNames.map((teacherName) => (
                              <div key={`${cl.id}-teacher-${teacherName}`} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{teacherName}</div>
                              </div>
                            )) : (
                              <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No teachers assigned yet.</div>
                            )}
                          </div>
                        </div>

                        <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, background: "var(--admin-bg-secondary)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>
                            Assigned Children
                          </div>
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {Array.isArray(cl.children) && cl.children.length ? cl.children.map((child) => (
                              <div key={child.id} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                                  {[child.firstName, child.lastName].filter(Boolean).join(" ") || "Unnamed child"}
                                </div>
                                {child.birthDate ? (
                                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--admin-text-muted)" }}>
                                    DOB: {new Date(child.birthDate).toLocaleDateString()}
                                  </div>
                                ) : null}
                              </div>
                            )) : (
                              <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No children assigned yet.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: bg, fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

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

const panelStyle = { background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 14, padding: 20 };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
  borderRadius: 10, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)", fontSize: 13,
};

const fieldLabelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)", marginBottom: 6 };

const cardStyle = {
  display: "flex", alignItems: "center", gap: 14, padding: 16,
  borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-bg)",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const cardActionBtn = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 12px",
  border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)",
  color: "var(--admin-text)", cursor: "pointer", fontWeight: 600, fontSize: 12,
};

const cardDangerBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 7,
  border: "1px solid #FECACA", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
};

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
