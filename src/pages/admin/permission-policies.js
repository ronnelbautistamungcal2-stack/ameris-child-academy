import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { DEFAULT_PERMISSION_POLICIES } from "@/lib/permissionPolicies";
import { useCallback, useEffect, useMemo, useState } from "react";

const panelStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 20,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 13,
};

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const cardStyle = {
  borderRadius: 14,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  padding: 16,
};

function sectionsToText(sections) {
  return Array.isArray(sections) ? sections.join("\n") : "";
}

function textToSections(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminPermissionPolicies() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [docs, setDocs] = useState([]);
  const [policies, setPolicies] = useState(DEFAULT_PERMISSION_POLICIES);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingType, setSavingType] = useState("");
  const [successType, setSuccessType] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/policies"),
        ]);
        setCenters(Array.isArray(c) ? c : []);
        setDocs(Array.isArray(p) ? p : []);
      } catch (e) {
        setError(e.message || "Failed to load centers/policies");
      }
    })();
  }, []);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = centerId ? `?centerId=${encodeURIComponent(centerId)}` : "";
      const data = await apiJson(`/api/v1/permission-policy-config${qs}`);
      const list = Array.isArray(data) && data.length ? data : DEFAULT_PERMISSION_POLICIES;
      setPolicies(list);
      setDrafts(
        Object.fromEntries(
          list.map((item) => [
            item.value,
            {
              label: item.label || "",
              description: item.description || "",
              policySummary: item.policySummary || "",
              policySections: sectionsToText(item.policySections),
              policyDocumentId: item.policyDocument?.id || "",
            },
          ]),
        ),
      );
    } catch (e) {
      setError(e.message || "Failed to load permission policies");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const availableDocs = useMemo(
    () => docs.filter((d) => !d.centerId || d.centerId === centerId),
    [docs, centerId],
  );

  function updateDraft(type, patch) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  async function saveType(type) {
    const draft = drafts[type];
    if (!draft) return;
    setSavingType(type);
    setError("");
    setSuccessType("");
    try {
      await apiJson("/api/v1/permission-policy-config", {
        method: "PUT",
        body: JSON.stringify({
          permissionType: type,
          centerId: centerId || null,
          label: draft.label || null,
          description: draft.description || null,
          policySummary: draft.policySummary || null,
          policySections: textToSections(draft.policySections),
          policyDocumentId: draft.policyDocumentId || null,
        }),
      });
      setSuccessType(type);
      setTimeout(() => setSuccessType(""), 2500);
      await loadPolicies();
    } catch (e) {
      setError(e.message || "Failed to save policy");
    } finally {
      setSavingType("");
    }
  }

  return (
    <AdminLayout title="Family Permission Policies">
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>
              Family Permission Policies
            </h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0 0" }}>
              Write the exact wording parents see for each permission on the Parent Permissions page, and
              attach a published policy document for the full details.
            </p>
          </div>
          <label style={{ display: "block", minWidth: 220 }}>
            <div style={fieldLabelStyle}>Center</div>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
              <option value="">All Centers (global default)</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {loading ? (
            <SkeletonTable rows={3} cols={2} />
          ) : (
            policies.map((item) => {
              const draft = drafts[item.value] || {};
              const isSaving = savingType === item.value;
              return (
                <div key={item.value} style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--admin-text)" }}>
                      {item.value.replaceAll("_", " ")}
                    </div>
                    {successType === item.value && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Saved</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                    <label style={{ display: "block" }}>
                      <div style={fieldLabelStyle}>Display label</div>
                      <input
                        value={draft.label || ""}
                        onChange={(e) => updateDraft(item.value, { label: e.target.value })}
                        style={inputStyle}
                        placeholder="e.g. Photo Release"
                      />
                    </label>
                    <label style={{ display: "block" }}>
                      <div style={fieldLabelStyle}>Short description</div>
                      <input
                        value={draft.description || ""}
                        onChange={(e) => updateDraft(item.value, { description: e.target.value })}
                        style={inputStyle}
                        placeholder="One-line summary shown on the card"
                      />
                    </label>
                  </div>

                  <label style={{ display: "block", marginTop: 12 }}>
                    <div style={fieldLabelStyle}>Policy summary</div>
                    <textarea
                      value={draft.policySummary || ""}
                      onChange={(e) => updateDraft(item.value, { policySummary: e.target.value })}
                      style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                      placeholder="Shown at the top of the policy review modal"
                    />
                  </label>

                  <label style={{ display: "block", marginTop: 12 }}>
                    <div style={fieldLabelStyle}>Policy details (one point per line)</div>
                    <textarea
                      value={draft.policySections || ""}
                      onChange={(e) => updateDraft(item.value, { policySections: e.target.value })}
                      style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                      placeholder={"Each line becomes its own point in the parent-facing policy."}
                    />
                  </label>

                  <label style={{ display: "block", marginTop: 12 }}>
                    <div style={fieldLabelStyle}>Attached policy document (optional)</div>
                    <select
                      value={draft.policyDocumentId || ""}
                      onChange={(e) => updateDraft(item.value, { policyDocumentId: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">No document attached</option>
                      {availableDocs.map((d) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => saveType(item.value)}
                      disabled={isSaving}
                      style={{
                        padding: "9px 18px",
                        background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        cursor: isSaving ? "not-allowed" : "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
