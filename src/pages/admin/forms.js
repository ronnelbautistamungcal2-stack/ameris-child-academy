import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export default function AdminForms() {
  const [templates, setTemplates] = useState([]);
  const [centers, setCenters] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("PARENT");
  const [centerId, setCenterId] = useState("");
  const [active, setActive] = useState(true);
  const [schemaText, setSchemaText] = useState("");
  const [requiresRenewal, setRequiresRenewal] = useState(false);
  const [renewalPeriodDays, setRenewalPeriodDays] = useState("");
  const [autoFillMappingText, setAutoFillMappingText] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [t, c, s] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/forms/submissions"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setCenters(Array.isArray(c) ? c : []);
      setSubmissions(Array.isArray(s) ? s : []);
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

      let autoFillMapping = null;
      const mappingTrimmed = autoFillMappingText.trim();
      if (mappingTrimmed) {
        try {
          autoFillMapping = JSON.parse(mappingTrimmed);
        } catch {
          throw new Error("Auto-fill mapping must be valid JSON (or empty).");
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
          requiresRenewal,
          renewalPeriodDays: requiresRenewal && renewalPeriodDays ? parseInt(renewalPeriodDays) : null,
          autoFillMapping,
        }),
      });
      setTitle("");
      setDescription("");
      setTargetRole("PARENT");
      setCenterId("");
      setActive(true);
      setSchemaText("");
      setRequiresRenewal(false);
      setRenewalPeriodDays("");
      setAutoFillMappingText("");
      setSuccess("Form template created.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create form template");
    } finally {
      setSaving(false);
    }
  }

  async function applyToChild(submissionId) {
    setApplying(submissionId);
    setError("");
    setSuccess("");
    try {
      const result = await apiJson(`/api/v1/forms/submissions/${submissionId}/apply`, { method: "POST" });
      setSuccess(`Applied to child record. Fields updated: ${(result.fieldsUpdated || []).join(", ")}`);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to apply form data");
    } finally {
      setApplying("");
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <Field label="Requires Renewal">
              <select value={requiresRenewal ? "true" : "false"} onChange={(e) => setRequiresRenewal(e.target.value === "true")} style={inputStyle}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
            {requiresRenewal && (
              <Field label="Renewal Period (days)">
                <input type="number" min="1" value={renewalPeriodDays} onChange={(e) => setRenewalPeriodDays(e.target.value)} style={inputStyle} placeholder="365" />
              </Field>
            )}
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

          <div style={{ marginTop: 10 }}>
            <Field label="Auto-fill Mapping (JSON, optional)">
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                Maps form data keys to child record fields. When a parent submits this form, an admin can apply the data directly to the child record.
              </div>
              <textarea
                value={autoFillMappingText}
                onChange={(e) => setAutoFillMappingText(e.target.value)}
                style={{ ...inputStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                rows={3}
                placeholder='{"emergencyContact": "emergencyContact", "allergies": "allergies"}'
              />
              <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" style={{ ...secondaryButton, fontSize: 10, padding: "2px 8px" }} onClick={() => setAutoFillMappingText(JSON.stringify({ emergencyContact: "emergencyContact", allergies: "allergies" }, null, 2))}>
                  Emergency Preset
                </button>
                <button type="button" style={{ ...secondaryButton, fontSize: 10, padding: "2px 8px" }} onClick={() => setAutoFillMappingText(JSON.stringify({ allergies: "allergies", healthDocuments: "healthAssessmentDocuments" }, null, 2))}>
                  Health Preset
                </button>
              </div>
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
          <SkeletonTable rows={3} cols={3} />
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
                  {t.requiresRenewal && ` · Renewal: every ${t.renewalPeriodDays} days`}
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

      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Form Submissions</h3>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
          Review parent submissions and apply form data to child records when auto-fill mapping is configured.
        </p>
        {loading ? (
          <SkeletonTable rows={3} cols={4} />
        ) : submissions.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No submissions yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
            {submissions.map((s) => {
              const hasMapping = s.template?.autoFillMapping && typeof s.template.autoFillMapping === "object" && Object.keys(s.template.autoFillMapping).length > 0;
              const canApply = hasMapping && s.childId && !s.appliedToChild;
              return (
                <div key={s.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{s.template?.title || "Unknown Template"}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        Submitted by: {s.submittedBy?.name || s.submittedBy?.email || "—"} · Status: {s.status}
                        {s.child ? ` · Child: ${s.child.firstName} ${s.child.lastName || ""}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {s.appliedToChild ? (
                        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 800, border: "1px solid #bbf7d0" }}>
                          Applied
                        </span>
                      ) : canApply ? (
                        <button
                          type="button"
                          disabled={applying === s.id}
                          onClick={() => applyToChild(s.id)}
                          style={{ ...primaryButton, fontSize: 11, padding: "4px 10px" }}
                        >
                          {applying === s.id ? "Applying..." : "Apply to Child"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {s.data && typeof s.data === "object" ? (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>View submitted data</summary>
                      <pre style={{ fontSize: 11, marginTop: 6, background: "#f9fafb", padding: 8, borderRadius: 6, overflow: "auto", maxHeight: 200 }}>
                        {JSON.stringify(s.data, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              );
            })}
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

