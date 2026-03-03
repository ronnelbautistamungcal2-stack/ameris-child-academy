import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "OTHER",
];

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
  const [createdAt, setCreatedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function loadActivities(id) {
    if (!id) {
      setActivities([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await apiJson(`/api/v1/activities?childId=${encodeURIComponent(id)}`);
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
    loadActivities(childId);
  }, [childId]);

  const childLabel = useMemo(() => {
    const ch = children.find((c) => c.id === childId);
    if (!ch) return "";
    return `${ch.firstName}${ch.lastName ? ` ${ch.lastName}` : ""}`;
  }, [children, childId]);

  async function createOverride(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { childId, type, notes };
      if (createdAt) payload.createdAt = new Date(createdAt).toISOString();
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotes("");
      setCreatedAt("");
      setSuccess(`Created activity for ${childLabel || "child"}.`);
      await loadActivities(childId);
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
      await loadActivities(childId);
    } catch (e) {
      setError(e.message || "Failed to delete activity");
    }
  }

  return (
    <AdminLayout title="Activity Overrides">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Override Teacher Activity Entries</h2>
        <p style={{ color: "var(--admin-text-muted)", marginTop: 6 }}>
          Admins can create and backdate activity logs and delete logs when needed.
        </p>

        {error ? <ErrorBanner kind="error" message={error} /> : null}
        {success ? <ErrorBanner kind="success" message={success} /> : null}

        <form onSubmit={createOverride} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Center">
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Child">
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                style={inputStyle}
                disabled={!centerId}
                required
              >
                <option value="">Select a child…</option>
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
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, marginTop: 10 }}>
            <Field label="Notes (optional)">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Created At (optional backdate)">
              <input
                type="datetime-local"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="submit" style={primaryButton} disabled={saving || !childId}>
                {saving ? "Saving…" : "Create Log"}
              </button>
            </div>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Recent Activity Logs</h3>
          {loading ? (
            <p>Loading…</p>
          ) : !childId ? (
            <p style={{ color: "var(--admin-text-muted)" }}>Select a child to view logs.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Notes</th>
                  <th style={thStyle}>Backdated</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td style={tdStyle}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <code style={codePill}>{a.type}</code>
                    </td>
                    <td style={tdStyle}>{a.notes || "—"}</td>
                    <td style={tdStyle}>{a.isBackdated ? "Yes" : "No"}</td>
                    <td style={tdStyle}>
                      <button type="button" style={dangerButton} onClick={() => deleteActivity(a.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {activities.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      No logs found.
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

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function ErrorBanner({ message, kind }) {
  const style =
    kind === "success"
      ? { background: "var(--admin-success-bg)", color: "var(--admin-success-text)", border: "1px solid var(--admin-success-border)" }
      : { background: "var(--admin-error-bg)", color: "var(--admin-error-text)", border: "1px solid var(--admin-error-border)" };

  return (
    <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...style }}>
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
  verticalAlign: "top",
};

const codePill = {
  background: "var(--admin-bg-tertiary)",
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
  fontWeight: 700,
};

const dangerButton = {
  padding: "10px 12px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};
