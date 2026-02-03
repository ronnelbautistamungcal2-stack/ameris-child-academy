import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export default function AdminForms() {
  const [templates, setTemplates] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("PARENT");
  const [centerId, setCenterId] = useState("");
  const [active, setActive] = useState(true);
  const [schemaText, setSchemaText] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [t, c] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/centers"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load form templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...templates].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [templates]);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let schema = null;
      const trimmed = schemaText.trim();
      if (trimmed) {
        try {
          schema = JSON.parse(trimmed);
        } catch {
          throw new Error("Schema must be valid JSON (or empty).");
        }
      }

      await apiJson("/api/v1/forms/templates", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          targetRole,
          centerId: centerId || null,
          active,
          schema,
        }),
      });
      setTitle("");
      setDescription("");
      setTargetRole("PARENT");
      setCenterId("");
      setActive(true);
      setSchemaText("");
      setSuccess("Form template created.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create form template");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/forms/templates/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !t.active }),
      });
      setSuccess(`${t.title} updated.`);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to update template");
    }
  }

  return (
    <AdminLayout title="Forms">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Online Forms</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Create form templates (enrollment/health/emergency/etc). Parents can submit forms from the Parent portal.
        </p>

        {error ? <Banner kind="error" message={error} /> : null}
        {success ? <Banner kind="success" message={success} /> : null}

        <form onSubmit={create} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />
            </Field>
            <Field label="Target Role">
              <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} style={inputStyle} required>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 10 }}>
            <Field label="Description (optional)">
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <Field label="Center (optional)">
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                <option value="">(all centers)</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Active">
              <select value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")} style={inputStyle}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 10 }}>
            <Field label="Schema (JSON, optional)">
              <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                style={{ ...inputStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                rows={6}
                placeholder='{"fields":[{"name":"emergencyContact","type":"text"}]}'
              />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={saving} style={primaryButton}>
              {saving ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Templates</h3>
        {loading ? (
          <p>Loading...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No templates yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {sorted.map((t) => (
              <div key={t.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800 }}>{t.title}</div>
                  <span style={pill(t.active)}>{t.active ? "Active" : "Inactive"}</span>
                </div>
                <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>{t.description || "—"}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Role: {t.targetRole} · Center: {t.centerId || "all"}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => toggleActive(t)} style={secondaryButton}>
                    {t.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, ...style }}>
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

function pill(active) {
  return {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${active ? "#bbf7d0" : "#e5e7eb"}`,
    background: active ? "#dcfce7" : "#f3f4f6",
    color: active ? "#166534" : "#374151",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryButton = {
  padding: "9px 12px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

