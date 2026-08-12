import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const SUPPLY_CATEGORIES = ["General", "Art", "Science", "Craft", "Outdoor", "Music", "Math", "Other"];

const CATEGORY_META = {
  General:  { icon: "📦", color: "#64748b" },
  Art:      { icon: "🎨", color: "#ec4899" },
  Science:  { icon: "🔬", color: "#6366f1" },
  Craft:    { icon: "✂️", color: "#f59e0b" },
  Outdoor:  { icon: "🌳", color: "#10b981" },
  Music:    { icon: "🎵", color: "#8b5cf6" },
  Math:     { icon: "🔢", color: "#0ea5e9" },
  Other:    { icon: "📝", color: "#94a3b8" },
};

export default function AdminSupplyLists() {
  const [centers, setCenters] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [supplyList, setSupplyList] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [lessonSearch, setLessonSearch] = useState("");

  // Manage supplies on individual lessons
  const [manageLessonId, setManageLessonId] = useState("");
  const [supplyRows, setSupplyRows] = useState([]);
  const [savingSupplies, setSavingSupplies] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(c) ? c : []);
        if (c.length) setCenterId(c[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadLessons = useCallback(async (cId) => {
    if (!cId) return;
    try {
      const data = await apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(cId)}`);
      setLessons(Array.isArray(data) ? data : []);
    } catch {
      setLessons([]);
    }
  }, []);

  const loadSupplyList = useCallback(async (cId) => {
    if (!cId) return;
    setSupplyLoading(true);
    try {
      const data = await apiJson(`/api/v1/lessons/supply-list?centerId=${encodeURIComponent(cId)}`);
      setSupplyList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load supply list");
    } finally {
      setSupplyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (centerId) {
      loadLessons(centerId);
      loadSupplyList(centerId);
    }
  }, [centerId, loadLessons, loadSupplyList]);

  const totalCost = useMemo(() => supplyList.reduce((sum, s) => sum + (s.estimatedCost || 0), 0), [supplyList]);
  const totalQty = useMemo(() => supplyList.reduce((s, i) => s + i.totalQuantity, 0), [supplyList]);
  const lessonsWithSupplies = useMemo(() => lessons.filter((l) => l.supplies && l.supplies.length > 0), [lessons]);

  const filteredSupplyList = useMemo(() => {
    let list = supplyList;
    if (filterCategory) list = list.filter((s) => s.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.unit || "").toLowerCase().includes(q) ||
        (s.lessons || []).some((l) => l.title.toLowerCase().includes(q))
      );
    }
    return list;
  }, [supplyList, filterCategory, search]);

  const filteredLessons = useMemo(() => {
    if (!lessonSearch.trim()) return lessons;
    const q = lessonSearch.toLowerCase();
    return lessons.filter((l) => l.title.toLowerCase().includes(q));
  }, [lessons, lessonSearch]);

  const categoryBreakdown = useMemo(() => {
    const counts = {};
    for (const s of supplyList) {
      const cat = s.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [supplyList]);

  function openManageSupplies(lesson) {
    setManageLessonId(lesson.id);
    setSupplyRows(
      (lesson.supplies || []).map((s) => ({
        name: s.name || "",
        quantity: s.quantity || 1,
        quantityType: s.quantityType === "per_student" ? "per_student" : "total",
        unit: s.unit || "",
        estimatedCost: s.estimatedCost || "",
        category: s.category || "General",
      })),
    );
    setError("");
    setSuccess("");
  }

  function addSupplyRow() {
    setSupplyRows((prev) => [...prev, { name: "", quantity: 1, quantityType: "total", unit: "", estimatedCost: "", category: "General" }]);
  }

  function removeSupplyRow(index) {
    setSupplyRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSupplyRow(index, field, value) {
    setSupplyRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveSupplies(e) {
    e.preventDefault();
    if (!manageLessonId) return;
    setSavingSupplies(true);
    setError("");
    setSuccess("");
    try {
      const validSupplies = supplyRows.filter((s) => s.name.trim());
      await apiJson(`/api/v1/lessons/${manageLessonId}`, {
        method: "PUT",
        body: JSON.stringify({ supplies: validSupplies }),
      });
      setSuccess("Supplies saved successfully.");
      setManageLessonId("");
      await loadLessons(centerId);
      await loadSupplyList(centerId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (e2) {
      setError(e2.message || "Failed to save supplies");
    } finally {
      setSavingSupplies(false);
    }
  }

  function exportCsv() {
    if (!supplyList.length) return;
    const lines = ["Name,Quantity,Type,Unit,Estimated Cost,Category,Lessons"];
    for (const s of supplyList) {
      const lessonNames = (s.lessons || []).map((l) => l.title).join("; ");
      lines.push(
        [
          csvEscape(s.name),
          s.totalQuantity,
          csvEscape(s.quantityType === "per_student" ? "Per Student" : "Total"),
          csvEscape(s.unit || ""),
          (s.estimatedCost || 0).toFixed(2),
          csvEscape(s.category || ""),
          csvEscape(lessonNames),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supply-list.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const dismissError = useCallback(() => setError(""), []);
  const dismissSuccess = useCallback(() => setSuccess(""), []);

  return (
    <AdminLayout title="Supply Lists">
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #0ea5e9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>
            📦
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Supply Lists</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)" }}>
              Consolidated supply lists auto-generated from lesson requirements.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={selectStyle}>
            <option value="">Select center</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="button" onClick={exportCsv} disabled={!supplyList.length} style={outlineButton}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 12v1.5a1 1 0 001 1h6a1 1 0 001-1V12M8 2v8M5 7l3 3 3-3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <AlertBanner kind="error" message={error} onDismiss={dismissError} />}
      {success && <AlertBanner kind="success" message={success} onDismiss={dismissSuccess} />}

      {loading || supplyLoading ? (
        <Panel><SkeletonTable rows={5} cols={4} /></Panel>
      ) : supplyList.length === 0 ? (
        <>
          <EmptyState
            icon="📋"
            title="No supplies found"
            description="Add supplies to lessons to auto-generate a consolidated supply list."
          />
          {/* Still show lesson manager even with no supplies */}
          <LessonManager
            lessons={lessons}
            filteredLessons={filteredLessons}
            lessonSearch={lessonSearch}
            setLessonSearch={setLessonSearch}
            manageLessonId={manageLessonId}
            supplyRows={supplyRows}
            savingSupplies={savingSupplies}
            openManageSupplies={openManageSupplies}
            setManageLessonId={setManageLessonId}
            addSupplyRow={addSupplyRow}
            removeSupplyRow={removeSupplyRow}
            updateSupplyRow={updateSupplyRow}
            saveSupplies={saveSupplies}
          />
        </>
      ) : (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard icon="📋" label="Unique Items" value={supplyList.length} color="#6366f1" />
            <StatCard icon="📊" label="Total Quantity" value={totalQty} color="#0ea5e9" />
            <StatCard icon="💰" label="Estimated Cost" value={`$${totalCost.toFixed(2)}`} color="#10b981" />
            <StatCard icon="📖" label="Lessons w/ Supplies" value={lessonsWithSupplies.length} color="#f59e0b" />
          </div>

          {/* Category Breakdown */}
          {Object.keys(categoryBreakdown).length > 1 && (
            <Panel style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>By Category</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                  const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
                  const isActive = filterCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCategory(isActive ? "" : cat)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 12px", borderRadius: 999,
                        border: isActive ? `2px solid ${meta.color}` : "1px solid var(--admin-border)",
                        background: isActive ? meta.color + "14" : "var(--admin-bg)",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: isActive ? meta.color : "var(--admin-text)",
                        transition: "all 0.15s",
                      }}
                    >
                      <span>{meta.icon}</span>
                      {cat}
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        background: isActive ? meta.color + "22" : "var(--admin-bg-tertiary)",
                        padding: "1px 6px", borderRadius: 999,
                        color: isActive ? meta.color : "var(--admin-text-muted)",
                      }}>{count}</span>
                    </button>
                  );
                })}
                {filterCategory && (
                  <button
                    type="button"
                    onClick={() => setFilterCategory("")}
                    style={{ ...linkButton, fontSize: 12 }}
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </Panel>
          )}

          {/* Supply List Table */}
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>All Supplies</span>
                <CountBadge count={filteredSupplyList.length} total={supplyList.length} />
              </div>
              <div style={{ position: "relative" }}>
                <SearchIcon />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search supplies…"
                  style={{ ...inputStyle, padding: "7px 12px 7px 32px", fontSize: 13, width: 200 }}
                />
              </div>
            </div>

            {filteredSupplyList.length === 0 ? (
              <EmptyState icon="🔍" title="No matching supplies" description="Try adjusting your search or filter." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Supply Name</th>
                      <th style={{ ...thStyle, width: 70 }}>Qty</th>
                      <th style={{ ...thStyle, width: 90 }}>Type</th>
                      <th style={{ ...thStyle, width: 80 }}>Unit</th>
                      <th style={{ ...thStyle, width: 100 }}>Est. Cost</th>
                      <th style={{ ...thStyle, width: 120 }}>Category</th>
                      <th style={thStyle}>Used In Lessons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplyList.map((s, idx) => {
                      const meta = CATEGORY_META[s.category] || CATEGORY_META.Other;
                      return (
                        <tr key={idx}
                          style={{ transition: "background 0.15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--admin-bg-secondary)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", minWidth: 28, textAlign: "center",
                              padding: "2px 8px", borderRadius: 6,
                              background: "var(--admin-bg-tertiary)", fontWeight: 700, fontSize: 13,
                            }}>
                              {s.totalQuantity}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 999,
                              background: s.quantityType === "per_student" ? "#f59e0b14" : "var(--admin-bg-tertiary)",
                              color: s.quantityType === "per_student" ? "#f59e0b" : "var(--admin-text-muted)",
                              fontWeight: 600, fontSize: 11,
                            }}>
                              {s.quantityType === "per_student" ? "Per Student" : "Total"}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: s.unit ? "var(--admin-text)" : "var(--admin-text-muted)" }}>
                            {s.unit || "—"}
                          </td>
                          <td style={tdStyle}>
                            {s.estimatedCost ? (
                              <span style={{ fontWeight: 600, color: "#10b981" }}>${(s.estimatedCost).toFixed(2)}</span>
                            ) : (
                              <span style={{ color: "var(--admin-text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "3px 10px 3px 6px", borderRadius: 999,
                              background: meta.color + "14", color: meta.color,
                              fontSize: 12, fontWeight: 600,
                            }}>
                              <span style={{ fontSize: 13 }}>{meta.icon}</span>
                              {s.category || "General"}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "var(--admin-text-muted)" }}>
                            {(s.lessons || []).length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {(s.lessons || []).map((l, li) => (
                                  <span key={li} style={{
                                    padding: "2px 8px", borderRadius: 6,
                                    background: "var(--admin-bg-tertiary)", fontSize: 11, fontWeight: 500,
                                    color: "var(--admin-text)", whiteSpace: "nowrap",
                                  }}>
                                    {l.title}
                                  </span>
                                ))}
                              </div>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Lesson Manager */}
          <LessonManager
            lessons={lessons}
            filteredLessons={filteredLessons}
            lessonSearch={lessonSearch}
            setLessonSearch={setLessonSearch}
            manageLessonId={manageLessonId}
            supplyRows={supplyRows}
            savingSupplies={savingSupplies}
            openManageSupplies={openManageSupplies}
            setManageLessonId={setManageLessonId}
            addSupplyRow={addSupplyRow}
            removeSupplyRow={removeSupplyRow}
            updateSupplyRow={updateSupplyRow}
            saveSupplies={saveSupplies}
          />
        </>
      )}
    </AdminLayout>
  );
}

/* ── Lesson Manager Section ─────────────────────────────────── */

function LessonManager({
  lessons, filteredLessons, lessonSearch, setLessonSearch,
  manageLessonId, supplyRows, savingSupplies,
  openManageSupplies, setManageLessonId,
  addSupplyRow, removeSupplyRow, updateSupplyRow, saveSupplies,
}) {
  const managingLesson = lessons.find((l) => l.id === manageLessonId);

  return (
    <Panel style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Manage Supplies per Lesson</div>
          <div style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 2 }}>
            Select a lesson to add or edit its supply requirements.
          </div>
        </div>
      </div>

      {manageLessonId && managingLesson ? (
        <div style={{
          border: "2px solid #6366f130", borderRadius: 12,
          background: "var(--admin-bg-secondary)", padding: 20,
        }}>
          {/* Editor Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "#6366f114", color: "#6366f1",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>✏️</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{managingLesson.title}</div>
                <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                  {supplyRows.length} supply item{supplyRows.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setManageLessonId("")} style={linkButton}>
              Cancel
            </button>
          </div>

          {/* Supply Rows */}
          <form onSubmit={saveSupplies}>
            {supplyRows.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--admin-text-muted)", fontSize: 13 }}>
                No supplies yet. Click "Add Supply" to get started.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {supplyRows.map((row, idx) => (
                <div key={idx} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 110px 70px 90px 110px 36px",
                  gap: 8, alignItems: "center",
                  background: "var(--admin-bg)", borderRadius: 10,
                  padding: "10px 12px",
                  border: "1px solid var(--admin-border)",
                }}>
                  <input
                    placeholder="Supply name"
                    value={row.name}
                    onChange={(e) => updateSupplyRow(idx, "name", e.target.value)}
                    style={inputStyle}
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => updateSupplyRow(idx, "quantity", parseInt(e.target.value) || 1)}
                    style={{ ...inputStyle, textAlign: "center" }}
                  />
                  <select
                    value={row.quantityType || "total"}
                    onChange={(e) => updateSupplyRow(idx, "quantityType", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="total">Total</option>
                    <option value="per_student">Per Student</option>
                  </select>
                  <input
                    placeholder="Unit"
                    value={row.unit}
                    onChange={(e) => updateSupplyRow(idx, "unit", e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$ Cost"
                    value={row.estimatedCost}
                    onChange={(e) => updateSupplyRow(idx, "estimatedCost", e.target.value)}
                    style={inputStyle}
                  />
                  <select
                    value={row.category}
                    onChange={(e) => updateSupplyRow(idx, "category", e.target.value)}
                    style={inputStyle}
                  >
                    {SUPPLY_CATEGORIES.map((c) => {
                      const m = CATEGORY_META[c];
                      return <option key={c} value={c}>{m?.icon} {c}</option>;
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSupplyRow(idx)}
                    title="Remove supply"
                    style={deleteIconBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--admin-text-muted)"; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M5 4.5l.5 8.5h5l.5-8.5M7 7v3.5M9 7v3.5" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Column labels (only show if there are rows) */}
            {supplyRows.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 110px 70px 90px 110px 36px",
                gap: 8, padding: "4px 12px 0",
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.05em", color: "var(--admin-text-muted)",
              }}>
                <span>Name</span><span>Qty</span><span>Type</span><span>Unit</span><span>Cost</span><span>Category</span><span></span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="button" onClick={addSupplyRow} style={outlineButton}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                Add Supply
              </button>
              <button type="submit" disabled={savingSupplies} style={primaryButton}>
                {savingSupplies ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Spinner /> Saving…
                  </span>
                ) : "Save Supplies"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Lesson Search */}
          {lessons.length > 6 && (
            <div style={{ marginBottom: 12, position: "relative" }}>
              <SearchIcon />
              <input
                value={lessonSearch}
                onChange={(e) => setLessonSearch(e.target.value)}
                placeholder="Search lessons…"
                style={{ ...inputStyle, padding: "8px 12px 8px 32px", fontSize: 13, maxWidth: 280 }}
              />
            </div>
          )}

          {/* Lesson Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {filteredLessons.slice(0, 60).map((lesson) => {
              const supCount = lesson.supplies?.length || 0;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => openManageSupplies(lesson)}
                  style={lessonCard}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f180"; e.currentTarget.style.background = "var(--admin-bg-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: supCount > 0 ? "#10b98114" : "var(--admin-bg-tertiary)",
                      color: supCount > 0 ? "#10b981" : "var(--admin-text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, flexShrink: 0,
                    }}>
                      {supCount > 0 ? "📦" : "📖"}
                    </div>
                    <div style={{ overflow: "hidden", textAlign: "left" }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "var(--admin-text)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {lesson.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 1 }}>
                        {supCount > 0 ? (
                          <span style={{ color: "#10b981", fontWeight: 600 }}>
                            {supCount} item{supCount !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          "No supplies"
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredLessons.length > 60 && (
            <div style={{ padding: 12, fontSize: 13, color: "var(--admin-text-muted)", textAlign: "center" }}>
              Showing first 60 lessons. Use search to find specific lessons.
            </div>
          )}
          {filteredLessons.length === 0 && lessons.length > 0 && (
            <EmptyState icon="🔍" title="No matching lessons" description="Try adjusting your search." />
          )}
          {lessons.length === 0 && (
            <EmptyState icon="📖" title="No lessons found" description="No lessons found for this center." />
          )}
        </>
      )}
    </Panel>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Panel({ children, style }) {
  return (
    <div style={{
      background: "var(--admin-bg)",
      border: "1px solid var(--admin-border)",
      borderRadius: 12, padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: "var(--admin-bg)",
      border: "1px solid var(--admin-border)",
      borderRadius: 12, padding: "16px 18px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -8, right: -8,
        width: 48, height: 48, borderRadius: "50%",
        background: color + "10",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color }}>{value}</div>
    </div>
  );
}

function CountBadge({ count, total }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, background: "var(--admin-bg-tertiary)",
      color: "var(--admin-text-muted)", padding: "2px 8px", borderRadius: 999,
    }}>
      {count}{count !== total ? ` / ${total}` : ""}
    </span>
  );
}

function AlertBanner({ message, kind, onDismiss }) {
  const isSuccess = kind === "success";
  const bg = isSuccess ? "var(--admin-success-bg)" : "var(--admin-error-bg)";
  const color = isSuccess ? "var(--admin-success-text)" : "var(--admin-error-text)";
  const border = isSuccess ? "var(--admin-success-border)" : "var(--admin-error-border)";
  const icon = isSuccess ? "✓" : "!";

  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10, marginBottom: 14,
      background: bg, color, border: `1px solid ${border}`,
      display: "flex", alignItems: "center", gap: 10, fontSize: 14,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999,
        background: color, color: bg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>{icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none", cursor: "pointer", color, fontSize: 18,
          lineHeight: 1, padding: 0, opacity: 0.6,
        }}>×</button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div style={{
      textAlign: "center", padding: "40px 20px",
      color: "var(--admin-text-muted)",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--admin-text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--admin-text-muted)" strokeWidth="1.5" strokeLinecap="round"
      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
      <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function csvEscape(val) {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ── Styles ──────────────────────────────────────────────────── */

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 13,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  outline: "none",
};

const selectStyle = {
  padding: "8px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  padding: "10px 14px",
  borderBottom: "2px solid var(--admin-border)",
};

const tdStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--admin-border-light, var(--admin-border))",
  verticalAlign: "middle",
  fontSize: 13,
};

const primaryButton = {
  padding: "8px 18px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  transition: "background 0.15s",
};

const outlineButton = {
  padding: "8px 14px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "all 0.15s",
};

const linkButton = {
  background: "none",
  border: "none",
  color: "var(--admin-text-muted)",
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  padding: 0,
};

const deleteIconBtn = {
  width: 32, height: 32, borderRadius: 8,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none",
  color: "var(--admin-text-muted)", cursor: "pointer",
  transition: "all 0.15s", flexShrink: 0,
};

const lessonCard = {
  display: "block",
  padding: "12px 14px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  background: "var(--admin-bg)",
  cursor: "pointer",
  transition: "all 0.15s",
  width: "100%",
};
