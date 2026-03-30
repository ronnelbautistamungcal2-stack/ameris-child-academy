import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TIERS = ["TRIAL", "BASIC", "PRO", "ENTERPRISE"];
const FEATURE_OPTIONS = [
  ["analytics", "Analytics"],
  ["messaging", "Messaging"],
  ["forms", "Forms"],
  ["exports", "Exports"],
  ["coachReports", "Coach Reports"],
  ["teacherMetrics", "Teacher Metrics"],
  ["pushNotifications", "Browser Notifications"],
  ["billingPortal", "Billing Portal"],
  ["autoPay", "Autopay"],
];

const EMPTY_FEATURES = FEATURE_OPTIONS.reduce((acc, [key]) => {
  acc[key] = false;
  return acc;
}, {});

const EMPTY_BILLING = {
  provider: "",
  customerId: "",
  portalUrl: "",
  paymentLinkUrl: "",
  supportEmail: "",
  invoiceEmail: "",
  autopayEnabled: false,
  cardBrand: "",
  cardLast4: "",
};

export default function AdminSubscriptions() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingCenter, setEditingCenter] = useState(null);
  const [tier, setTier] = useState("BASIC");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [features, setFeatures] = useState(EMPTY_FEATURES);
  const [billing, setBilling] = useState(EMPTY_BILLING);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(
    () => [...centers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [centers],
  );

  function startEdit(center) {
    setEditingCenter(center);
    setTier(center.subscription?.tier || "BASIC");
    setActive(center.subscription ? !!center.subscription.active : true);
    setExpiresAt(center.subscription?.expiresAt ? center.subscription.expiresAt.slice(0, 10) : "");
    setFeatures({ ...EMPTY_FEATURES, ...(center.subscription?.features || {}) });
    setBilling({ ...EMPTY_BILLING, ...(center.subscription?.billing || {}) });
  }

  function clearForm() {
    setEditingCenter(null);
    setTier("BASIC");
    setActive(true);
    setExpiresAt("");
    setFeatures(EMPTY_FEATURES);
    setBilling(EMPTY_BILLING);
  }

  function toggleFeature(key) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setBillingField(field, value) {
    setBilling((prev) => ({ ...prev, [field]: value }));
  }

  async function saveSubscription(e) {
    e.preventDefault();
    if (!editingCenter) return;
    setError("");
    try {
      await apiJson("/api/v1/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          centerId: editingCenter.id,
          tier,
          active,
          expiresAt: expiresAt || null,
          features,
          billing,
        }),
      });
      await refresh();
      clearForm();
    } catch (err) {
      setError(err.message || "Failed to save subscription");
    }
  }

  async function deleteSubscription(center) {
    if (!center.subscription?.id) return;
    if (!confirm("Delete this subscription record?")) return;
    setError("");
    try {
      await apiJson(`/api/v1/subscriptions/${center.subscription.id}`, { method: "DELETE" });
      await refresh();
      if (editingCenter?.id === center.id) clearForm();
    } catch (err) {
      setError(err.message || "Failed to delete subscription");
    }
  }

  return (
    <AdminLayout title="Subscriptions">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Subscriptions</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Manage plan tier, feature access, and hosted billing actions per center.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 16, marginTop: 12 }}>
          <div>
            {loading ? (
              <SkeletonTable rows={3} cols={4} />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Center</th>
                    <th style={thStyle}>Tier</th>
                    <th style={thStyle}>Billing</th>
                    <th style={thStyle}>Features</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((center) => (
                    <tr key={center.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{center.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>{center.address || "-"}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{center.subscription?.tier || "-"}</div>
                        <div style={{ color: center.subscription?.active ? "#047857" : "#b45309", fontSize: 12, marginTop: 2 }}>
                          {center.subscription ? (center.subscription.active ? "Active" : "Inactive") : "Not configured"}
                        </div>
                        {center.subscription?.expiresAt ? (
                          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                            Expires {new Date(center.subscription.expiresAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{center.subscription?.billing?.provider || "-"}</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                          {center.subscription?.billing?.portalUrl
                            ? "Portal ready"
                            : center.subscription?.billing?.paymentLinkUrl
                              ? "Payment link ready"
                              : "Support only"}
                        </div>
                        {center.subscription?.billing?.cardBrand || center.subscription?.billing?.cardLast4 ? (
                          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                            {[center.subscription.billing.cardBrand, center.subscription.billing.cardLast4].filter(Boolean).join(" ")}
                          </div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {FEATURE_OPTIONS.filter(([key]) => center.subscription?.features?.[key]).length ? (
                            FEATURE_OPTIONS.filter(([key]) => center.subscription?.features?.[key]).map(([, label]) => (
                              <span key={label} style={featureChipStyle}>
                                {label}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "#6b7280", fontSize: 12 }}>No overrides</span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" style={secondaryButton} onClick={() => startEdit(center)}>
                            {center.subscription ? "Edit" : "Create"}
                          </button>
                          {center.subscription ? (
                            <button type="button" style={dangerButton} onClick={() => deleteSubscription(center)}>
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={5}>
                        No centers found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>

          <div style={editorPanelStyle}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {editingCenter ? `Edit: ${editingCenter.name}` : "Select a center"}
            </div>

            {editingCenter ? (
              <form onSubmit={saveSubscription}>
                <Field label="Tier">
                  <select value={tier} onChange={(e) => setTier(e.target.value)} style={inputStyle}>
                    {TIERS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    <span style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>Active</span>
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Expires At">
                    <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} type="date" />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Feature Flags">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {FEATURE_OPTIONS.map(([key, label]) => (
                        <label key={key} style={{ ...featureToggleStyle, background: features[key] ? "#eff6ff" : "#fff" }}>
                          <input type="checkbox" checked={!!features[key]} onChange={() => toggleFeature(key)} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Billing Provider">
                    <input
                      value={billing.provider}
                      onChange={(e) => setBillingField("provider", e.target.value)}
                      style={inputStyle}
                      placeholder="stripe / manual / custom"
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Customer ID">
                    <input
                      value={billing.customerId}
                      onChange={(e) => setBillingField("customerId", e.target.value)}
                      style={inputStyle}
                      placeholder="cus_..."
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Billing Portal URL">
                    <input
                      value={billing.portalUrl}
                      onChange={(e) => setBillingField("portalUrl", e.target.value)}
                      style={inputStyle}
                      placeholder="https://... or mailto:..."
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Payment Link URL">
                    <input
                      value={billing.paymentLinkUrl}
                      onChange={(e) => setBillingField("paymentLinkUrl", e.target.value)}
                      style={inputStyle}
                      placeholder="https://... or mailto:..."
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Support Email">
                    <input value={billing.supportEmail} onChange={(e) => setBillingField("supportEmail", e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Invoice Email">
                    <input value={billing.invoiceEmail} onChange={(e) => setBillingField("invoiceEmail", e.target.value)} style={inputStyle} />
                  </Field>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Card Brand">
                    <input value={billing.cardBrand} onChange={(e) => setBillingField("cardBrand", e.target.value)} style={inputStyle} placeholder="Visa" />
                  </Field>
                  <Field label="Card Last 4">
                    <input value={billing.cardLast4} onChange={(e) => setBillingField("cardLast4", e.target.value)} style={inputStyle} maxLength={4} placeholder="4242" />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={!!billing.autopayEnabled}
                      onChange={(e) => setBillingField("autopayEnabled", e.target.checked)}
                    />
                    <span style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>Autopay enabled</span>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="submit" style={primaryButton}>
                    Save
                  </button>
                  <button type="button" style={secondaryButton} onClick={clearForm}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>
                Choose a center to manage tier defaults, feature access, and hosted billing links.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
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

function ErrorBanner({ message }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#fee2e2",
        color: "#991b1b",
        borderRadius: 8,
        marginTop: 12,
        border: "1px solid #fecaca",
      }}
    >
      {message}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
};

const thStyle = {
  textAlign: "left",
  fontSize: 12,
  color: "#6b7280",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

const editorPanelStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  background: "#fff",
  height: "fit-content",
};

const featureChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 700,
};

const featureToggleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
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
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
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
