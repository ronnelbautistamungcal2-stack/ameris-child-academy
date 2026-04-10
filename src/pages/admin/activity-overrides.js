import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState, useCallback } from "react";

const TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "INCIDENT",
  "OTHER",
];

const TYPE_META = {
  INCIDENT:      { label: "Incident",      icon: "!", color: "#dc2626" },
  DIAPER_CHANGE: { label: "Diaper Change", icon: "🧷", color: "#8b5cf6" },
  NAP:           { label: "Nap",           icon: "😴", color: "#6366f1" },
  BOTTLE:        { label: "Bottle",        icon: "🍼", color: "#0ea5e9" },
  MEAL:          { label: "Meal",          icon: "🍽️", color: "#f59e0b" },
  SNACK:         { label: "Snack",         icon: "🍎", color: "#10b981" },
  ACTIVITY:      { label: "Activity",      icon: "🎨", color: "#ec4899" },
  TASK_CHECKLIST:{ label: "Task / Checklist", icon: "✅", color: "#14b8a6" },
  BEHAVIOR:      { label: "Behavior",      icon: "📋", color: "#f97316" },
  OTHER:         { label: "Other",         icon: "📝", color: "#64748b" },
};

function relativeTime(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminActivityOverrides() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const initialCenterId =
    typeof router.query.centerId === "string" ? router.query.centerId : "";
  const initialChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";
  const [centerId, setCenterId] = useState(initialCenterId);
  const [childId, setChildId] = useState(initialChildId);
  const [activities, setActivities] = useState([]);
  const [type, setType] = useState("MEAL");
  const [notes, setNotes] = useState("");
  const [detailsText, setDetailsText] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [showBackdate, setShowBackdate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editType, setEditType] = useState("OTHER");
  const [editNotes, setEditNotes] = useState("");
  const [editDetailsText, setEditDetailsText] = useState("");
  const [editCreatedAt, setEditCreatedAt] = useState("");

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const c = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(c) ? c : []);
      if (Array.isArray(c) && c.length === 1) setCenterId(c[0].id);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadChildren(id) {
    if (!id) {
      setChildren([]);
      setChildId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kids = await apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`);
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities() {
    if (!centerId && !childId) {
      setActivities([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (childId) qs.set("childId", childId);
      else if (centerId) qs.set("centerId", centerId);
      const list = await apiJson(`/api/v1/activities?${qs.toString()}`);
      setActivities(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCenters();
  }, []);

  useEffect(() => {
    setSuccess("");
    loadChildren(centerId);
  }, [centerId]);

  useEffect(() => {
    setSuccess("");
    loadActivities();
  }, [childId, centerId]);

  const childLabel = useMemo(() => {
    const ch = children.find((c) => c.id === childId);
    if (!ch) return "";
    return `${ch.firstName}${ch.lastName ? ` ${ch.lastName}` : ""}`;
  }, [children, childId]);

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filterType) list = list.filter((a) => a.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.notes || "").toLowerCase().includes(q) ||
          (TYPE_META[a.type]?.label || a.type).toLowerCase().includes(q) ||
          (a.recordedBy?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, filterType, search]);

  async function createOverride(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let details = null;
      if (detailsText.trim()) {
        try {
          details = JSON.parse(detailsText);
        } catch {
          details = { note: detailsText.trim() };
        }
      }
      const payload = { childId, type, notes, details };
      if (createdAt) payload.createdAt = new Date(createdAt).toISOString();
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotes("");
      setDetailsText("");
      setCreatedAt("");
      setShowBackdate(false);
      setSuccess(`Activity "${TYPE_META[type]?.label || type}" created for ${childLabel || "child"}.`);
      await loadActivities();
    } catch (e2) {
      setError(e2.message || "Failed to create activity");
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(id) {
    if (!confirm("Delete this activity log? This cannot be undone.")) return;
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/activities/${id}`, { method: "DELETE" });
      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to delete activity");
    }
  }

  function startEditActivity(activity) {
    setEditingId(activity.id);
    setEditType(activity.type || "OTHER");
    setEditNotes(activity.notes || "");
    setEditDetailsText(activity.details ? JSON.stringify(activity.details, null, 2) : "");
    setEditCreatedAt(toLocalDateTimeInput(activity.createdAt));
  }

  function cancelEditActivity() {
    setEditingId("");
    setEditType("OTHER");
    setEditNotes("");
    setEditDetailsText("");
    setEditCreatedAt("");
  }

  async function saveActivity(id) {
    setError("");
    setSuccess("");
    try {
      let details = null;
      if (editDetailsText.trim()) {
        try {
          details = JSON.parse(editDetailsText);
        } catch {
          setError("Details must be valid JSON.");
          return;
        }
      }
      await apiJson(`/api/v1/activities/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          type: editType,
          notes: editNotes,
          details,
          createdAt: editCreatedAt ? new Date(editCreatedAt).toISOString() : undefined,
        }),
      });
      cancelEditActivity();
      setSuccess("Activity log updated.");
      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to update activity");
    }
  }

  const dismissError = useCallback(() => setError(""), []);
  const dismissSuccess = useCallback(() => setSuccess(""), []);

  return (
    <AdminLayout title="Activity Overrides">
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>
            📝
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Activity Overrides</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)" }}>
              Create backdated activity logs or remove incorrect entries for any child.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <AlertBanner kind="error" message={error} onDismiss={dismissError} />}
      {success && <AlertBanner kind="success" message={success} onDismiss={dismissSuccess} />}

      {/* Selector Row */}
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Select Child</span>
          <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Choose a center and child to manage their activity logs</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Center" icon="🏫">
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Child" icon="👶">
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              style={{ ...inputStyle, opacity: centerId ? 1 : 0.5 }}
              disabled={!centerId}
            >
              <option value="">{centerId ? "Select a child…" : "Select a center first"}</option>
              {children
                .slice()
                .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </Panel>

      {/* Create Form */}
      {childId && (
        <Panel style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>New Activity Log</span>
            <Chip>{childLabel}</Chip>
          </div>
          <form onSubmit={createOverride}>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 12, alignItems: "end" }}>
              <Field label="Activity Type">
                <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t]?.icon} {TYPE_META[t]?.label || t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any details about this activity…"
                  style={inputStyle}
                />
              </Field>
              <button type="submit" className="admin-btn-primary" style={primaryButton} disabled={saving || !childId}>
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Spinner /> Saving…
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
                    </svg>
                    Create Log
                  </span>
                )}
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <Field label="Details JSON or note (optional)">
                <textarea
                  value={detailsText}
                  onChange={(e) => setDetailsText(e.target.value)}
                  placeholder='Example: {"time":"09:30","behaviorLevel":"2"}'
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                />
              </Field>
            </div>

            {/* Backdate toggle */}
            <div style={{ marginTop: 10 }}>
              {!showBackdate ? (
                <button
                  type="button"
                  onClick={() => setShowBackdate(true)}
                  style={{ background: "none", border: "none", color: "var(--admin-text-muted)", fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  + Backdate this entry
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "end", gap: 12, padding: 12, background: "var(--admin-bg-tertiary)", borderRadius: 8, marginTop: 4 }}>
                  <Field label="Backdate To">
                    <input
                      type="datetime-local"
                      value={createdAt}
                      onChange={(e) => setCreatedAt(e.target.value)}
                      style={{ ...inputStyle, maxWidth: 260 }}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => { setShowBackdate(false); setCreatedAt(""); }}
                    style={{ background: "none", border: "none", color: "var(--admin-text-muted)", fontSize: 13, cursor: "pointer", padding: "10px 0", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </form>
        </Panel>
      )}

      {/* Activity Logs Table */}
      <Panel style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Activity Logs</span>
            {childId && activities.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, background: "var(--admin-bg-tertiary)",
                color: "var(--admin-text-muted)", padding: "2px 8px", borderRadius: 999,
              }}>
                {filteredActivities.length}{filteredActivities.length !== activities.length ? ` / ${activities.length}` : ""}
              </span>
            )}
          </div>
          {childId && activities.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label || t}</option>
                ))}
              </select>
              <div style={{ position: "relative" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--admin-text-muted)" strokeWidth="1.5" strokeLinecap="round"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes…"
                  style={{ ...inputStyle, padding: "6px 10px 6px 32px", fontSize: 13, width: 180 }}
                />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : !centerId ? (
          <EmptyState
            icon="👆"
            title="No center selected"
            description="Select a center above to view and manage activity logs."
          />
        ) : filteredActivities.length === 0 && activities.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No activity logs yet"
            description={`No logs found for ${childLabel || "this child"}. Use the form above to create one.`}
          />
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No matching logs"
            description="Try adjusting your search or filter."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Child</th>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Notes</th>
                  <th style={{ ...thStyle, width: 90, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((a) => {
                  const meta = TYPE_META[a.type] || TYPE_META.OTHER;
                  return (
                    <Fragment key={a.id}>
                    <tr style={{ transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--admin-bg-secondary)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 10px 3px 6px", borderRadius: 999,
                          background: meta.color + "14", color: meta.color,
                          fontSize: 13, fontWeight: 600,
                        }}>
                          <span style={{ fontSize: 15 }}>{meta.icon}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.child ? `${a.child.firstName || ""} ${a.child.lastName || ""}`.trim() : childLabel || "—"}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{relativeTime(a.createdAt)}</div>
                        <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                          {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          {a.isBackdated && (
                            <span style={{
                              marginLeft: 6, padding: "1px 6px", borderRadius: 999, fontSize: 10,
                              background: "#f59e0b22", color: "#b45309", fontWeight: 600,
                            }}>
                              Backdated
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: a.notes ? "var(--admin-text)" : "var(--admin-text-muted)", fontStyle: a.notes ? "normal" : "italic" }}>
                        {a.notes || "No notes"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                          <button type="button" onClick={() => startEditActivity(a)} style={smallActionButton}>Edit</button>
                          <button
                            type="button"
                            onClick={() => deleteActivity(a.id)}
                            title="Delete this log"
                            style={deleteIconButton}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--admin-text-muted)"; }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M5 4.5l.5 8.5h5l.5-8.5M7 7v3.5M9 7v3.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === a.id && (
                      <tr>
                        <td colSpan={5} style={{ ...tdStyle, background: "var(--admin-bg-secondary)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "180px 220px 1fr", gap: 10, alignItems: "start" }}>
                            <Field label="Type">
                              <select value={editType} onChange={(e) => setEditType(e.target.value)} style={inputStyle}>
                                {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
                              </select>
                            </Field>
                            <Field label="Date & Time">
                              <input type="datetime-local" value={editCreatedAt} onChange={(e) => setEditCreatedAt(e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Notes">
                              <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} style={inputStyle} />
                            </Field>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <Field label="Details JSON">
                              <textarea value={editDetailsText} onChange={(e) => setEditDetailsText(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
                            </Field>
                          </div>
                          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button type="button" onClick={cancelEditActivity} style={secondaryButton}>Cancel</button>
                            <button type="button" onClick={() => saveActivity(a.id)} style={primaryButton}>Save Changes</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AdminLayout>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Panel({ children, style }) {
  return (
    <div
      style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        {label}
      </div>
      {children}
    </label>
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
      background: bg, color: color, border: `1px solid ${border}`,
      display: "flex", alignItems: "center", gap: 10, fontSize: 14,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999,
        background: color, color: bg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>
        {icon}
      </span>
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

function Chip({ children }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: "2px 10px",
      borderRadius: 999, background: "#6366f114", color: "#6366f1",
    }}>
      {children}
    </span>
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

/* ── Styles ──────────────────────────────────────────────────── */

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  transition: "border-color 0.15s, box-shadow 0.15s",
  outline: "none",
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
};

const primaryButton = {
  padding: "9px 18px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
  transition: "background 0.15s, opacity 0.15s",
};

const secondaryButton = {
  padding: "9px 14px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const smallActionButton = {
  ...secondaryButton,
  padding: "6px 10px",
  fontSize: 12,
};

const deleteIconButton = {
  width: 32, height: 32, borderRadius: 8,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none",
  color: "var(--admin-text-muted)", cursor: "pointer",
  transition: "all 0.15s",
};
