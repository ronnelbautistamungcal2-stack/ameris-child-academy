import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminParentInvolvement() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [activities, setActivities] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("activities");

  const [form, setForm] = useState({ title: "", description: "" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [filterParent, setFilterParent] = useState("");
  const [parents, setParents] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadActivities = useCallback(async () => {
    if (!centerId) { setActivities([]); return; }
    try {
      const data = await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}`);
      setActivities(Array.isArray(data) ? data : []);
    } catch {}
  }, [centerId]);

  const loadRecords = useCallback(async () => {
    if (!centerId) { setRecords([]); setParents([]); return; }
    try {
      const qs = new URLSearchParams({ centerId });
      if (filterParent) qs.set("parentId", filterParent);
      const data = await apiJson(`/api/v1/parent-involvement?${qs}`);
      const arr = Array.isArray(data) ? data : [];
      setRecords(arr);
      // Extract unique parents for filter
      const parentMap = {};
      arr.forEach((r) => { if (r.parent) parentMap[r.parent.id] = r.parent; });
      setParents(Object.values(parentMap));
    } catch {}
  }, [centerId, filterParent]);

  useEffect(() => { loadActivities(); }, [loadActivities]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !centerId) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}`, {
        method: "POST",
        body: JSON.stringify({ title: form.title.trim(), description: form.description || null }),
      });
      setForm({ title: "", description: "" });
      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id) => {
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/parent-involvement/activities/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editForm.title.trim(), description: editForm.description || null }),
      });
      setEditId(null);
      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deactivate this activity?")) return;
    try {
      await apiJson(`/api/v1/parent-involvement/activities/${id}`, { method: "DELETE" });
      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  };

  return (
    <AdminLayout title="Parent Involvement Activities">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Parent Involvement</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: "#6b7280" }}>
            Define involvement activities for parents to log, and view submitted records.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {centers.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Center</label>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, width: 280 }}
                >
                  <option value="">Select a center…</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
              {[
                { key: "activities", label: "Manage Activities" },
                { key: "records", label: "View Records" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
                    color: tab === t.key ? "#2563eb" : "#6b7280",
                    background: "none",
                    cursor: "pointer",
                    marginBottom: -2,
                  }}
                >{t.label}</button>
              ))}
            </div>

            {error ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>{error}</div>
            ) : null}

            {tab === "activities" && (
              <div>
                {!centerId ? (
                  <p style={{ color: "#9ca3af", fontSize: 14 }}>Select a center to manage activities.</p>
                ) : (
                  <>
                    {/* Add form */}
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Add New Activity</div>
                      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Title *</label>
                          <input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            required
                            placeholder="e.g. Volunteered in classroom"
                            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Description (optional)</label>
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2}
                            placeholder="Brief description for parents…"
                            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={saving || !form.title.trim()}
                          style={{ alignSelf: "flex-start", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
                        >{saving ? "Saving…" : "Add Activity"}</button>
                      </form>
                    </div>

                    {/* Activity list */}
                    {activities.length === 0 ? (
                      <div style={{ color: "#9ca3af", fontSize: 14 }}>No activities yet. Add one above.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {activities.map((a) => (
                          <div key={a.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                            {editId === a.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <input
                                  value={editForm.title}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
                                />
                                <textarea
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  rows={2}
                                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
                                />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => handleEdit(a.id)} disabled={saving} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                                  <button onClick={() => setEditId(null)} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{a.title}</div>
                                  {a.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{a.description}</div>}
                                </div>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  <button
                                    onClick={() => { setEditId(a.id); setEditForm({ title: a.title, description: a.description || "" }); }}
                                    style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "#374151" }}
                                  >Edit</button>
                                  <button
                                    onClick={() => handleDelete(a.id)}
                                    style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}
                                  >Remove</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "records" && (
              <div>
                {!centerId ? (
                  <p style={{ color: "#9ca3af", fontSize: 14 }}>Select a center to view records.</p>
                ) : (
                  <>
                    <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Filter by Parent</label>
                        <select
                          value={filterParent}
                          onChange={(e) => setFilterParent(e.target.value)}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", fontSize: 13, minWidth: 200 }}
                        >
                          <option value="">All parents</option>
                          {parents.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={loadRecords}
                        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >Refresh</button>
                    </div>

                    {records.length === 0 ? (
                      <div style={{ color: "#9ca3af", fontSize: 14 }}>No records yet.</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Activity</th>
                            <th style={{ padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Parent</th>
                            <th style={{ padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Child</th>
                            <th style={{ padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Date & Time</th>
                            <th style={{ padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ padding: "9px 12px", fontWeight: 600, color: "#111827" }}>{r.activity?.title}</td>
                              <td style={{ padding: "9px 12px", color: "#374151" }}>{r.parent?.name || r.parent?.email || "—"}</td>
                              <td style={{ padding: "9px 12px", color: "#374151" }}>
                                {r.child ? `${r.child.firstName} ${r.child.lastName}` : "—"}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#6b7280" }}>{formatDateTime(r.occurredAt)}</td>
                              <td style={{ padding: "9px 12px", color: "#6b7280" }}>{r.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
