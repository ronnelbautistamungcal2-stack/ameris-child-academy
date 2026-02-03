import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TIERS = ["TRIAL", "BASIC", "PRO", "ENTERPRISE"];

export default function AdminSubscriptions() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingCenter, setEditingCenter] = useState(null);
  const [tier, setTier] = useState("BASIC");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [paymentInfoText, setPaymentInfoText] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...centers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [centers]);

  function startEdit(center) {
    setEditingCenter(center);
    setTier(center.subscription?.tier || "BASIC");
    setActive(center.subscription ? !!center.subscription.active : true);
    setExpiresAt(center.subscription?.expiresAt ? center.subscription.expiresAt.slice(0, 10) : "");
    setPaymentInfoText(
      center.subscription?.paymentInfo
        ? JSON.stringify(center.subscription.paymentInfo, null, 2)
        : "",
    );
  }

  function clearForm() {
    setEditingCenter(null);
    setTier("BASIC");
    setActive(true);
    setExpiresAt("");
    setPaymentInfoText("");
  }

  function parsePaymentInfo(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error("paymentInfo must be valid JSON (or empty).");
    }
  }

  async function saveSubscription(e) {
    e.preventDefault();
    if (!editingCenter) return;
    setError("");
    try {
      const paymentInfo = parsePaymentInfo(paymentInfoText);
      await apiJson("/api/v1/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          centerId: editingCenter.id,
          tier,
          active,
          expiresAt: expiresAt || null,
          paymentInfo,
        }),
      });
      await refresh();
      clearForm();
    } catch (e2) {
      setError(e2.message || "Failed to save subscription");
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
    } catch (e2) {
      setError(e2.message || "Failed to delete subscription");
    }
  }

  return (
    <AdminLayout title="Subscriptions">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Subscriptions</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Approve and manage subscriptions per center (tier, active status, expiry).
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, marginTop: 12 }}>
          <div>
            {loading ? (
              <p>Loading…</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Center</th>
                    <th style={thStyle}>Tier</th>
                    <th style={thStyle}>Active</th>
                    <th style={thStyle}>Expires</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={c.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>{c.address || "—"}</div>
                      </td>
                      <td style={tdStyle}>{c.subscription?.tier || "—"}</td>
                      <td style={tdStyle}>{c.subscription ? (c.subscription.active ? "Yes" : "No") : "—"}</td>
                      <td style={tdStyle}>
                        {c.subscription?.expiresAt
                          ? new Date(c.subscription.expiresAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" style={secondaryButton} onClick={() => startEdit(c)}>
                            {c.subscription ? "Edit" : "Create"}
                          </button>
                          {c.subscription ? (
                            <button type="button" style={dangerButton} onClick={() => deleteSubscription(c)}>
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

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
              height: "fit-content",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {editingCenter ? `Edit: ${editingCenter.name}` : "Select a center"}
            </div>
            {editingCenter ? (
              <form onSubmit={saveSubscription}>
                <Field label="Tier">
                  <select value={tier} onChange={(e) => setTier(e.target.value)} style={inputStyle}>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    <span style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>Active</span>
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Expires At">
                    <input
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      style={inputStyle}
                      type="date"
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Field label="Payment Info (JSON)">
                    <textarea
                      value={paymentInfoText}
                      onChange={(e) => setPaymentInfoText(e.target.value)}
                      style={{ ...inputStyle, minHeight: 140, fontFamily: "monospace" }}
                      placeholder='{"provider":"stripe","customerId":"cus_..."}'
                    />
                  </Field>
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
                Click “Create/Edit” on a center to manage its subscription.
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

