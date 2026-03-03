import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function FormRenewals() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [checking, setChecking] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(`/api/v1/forms/renewals?status=${filter}`);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load renewals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [filter]);

  async function runCheck() {
    setChecking(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiJson("/api/v1/forms/renewals/check", { method: "POST" });
      setSuccess(`${result.message}. Notifications created: ${result.created}. Expiring: ${result.summary?.expiringSoon || 0}, Expired: ${result.summary?.expired || 0}`);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to run renewal check");
    } finally {
      setChecking(false);
    }
  }

  const counts = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    let expiring = 0, expired = 0, active = 0;
    for (const s of submissions) {
      if (!s.expiresAt) continue;
      const exp = new Date(s.expiresAt);
      if (exp < now) expired++;
      else if (exp <= thirtyDays) expiring++;
      else active++;
    }
    return { expiring, expired, active, total: submissions.length };
  }, [submissions]);

  return (
    <AdminLayout title="Form Renewals">
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Form Renewals</h2>
            <p style={{ color: "var(--admin-text-muted)", margin: 0 }}>Track form expirations and send renewal reminders.</p>
          </div>
          <button type="button" onClick={runCheck} disabled={checking} style={primaryButton}>
            {checking ? "Checking..." : "Run Renewal Check"}
          </button>
        </div>

        {error && <Banner kind="error" message={error} />}
        {success && <Banner kind="success" message={success} />}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16 }}>
          <StatCard label="Expiring Soon" value={counts.expiring} color="var(--admin-warning-text)" bg="var(--admin-warning-bg)" />
          <StatCard label="Expired" value={counts.expired} color="var(--admin-error-text)" bg="var(--admin-error-bg)" />
          <StatCard label="Active" value={counts.active} color="var(--admin-success-text)" bg="var(--admin-success-bg)" />
          <StatCard label="Total" value={counts.total} color="var(--admin-text-secondary)" bg="var(--admin-bg-tertiary)" />
        </div>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["all", "expiring", "expired"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={filter === f ? { ...filterBtn, background: "#2563eb", color: "white", borderColor: "#2563eb" } : filterBtn}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : submissions.length === 0 ? (
          <p style={{ color: "var(--admin-text-muted)" }}>No forms with renewal tracking found.</p>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Form</th>
                  <th style={thStyle}>Child</th>
                  <th style={thStyle}>Submitted By</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const status = s.renewalStatus || "active";
                  return (
                    <tr key={s.id}>
                      <td style={tdStyle}><div style={{ fontWeight: 700 }}>{s.template?.title || "—"}</div></td>
                      <td style={tdStyle}>{s.child ? `${s.child.firstName} ${s.child.lastName || ""}` : "—"}</td>
                      <td style={tdStyle}>{s.submittedBy?.name || s.submittedBy?.email || "—"}</td>
                      <td style={tdStyle}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "—"}</td>
                      <td style={tdStyle}>
                        <span style={statusPill(status)}>
                          {status === "expired" ? "Expired" : status === "expiring" ? "Expiring Soon" : "Active"}
                        </span>
                      </td>
                    </tr>
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

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: bg, border: "1px solid var(--admin-border)" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color }}>{label}</div>
    </div>
  );
}

function statusPill(status) {
  const colors = {
    expired: { bg: "var(--admin-error-bg)", color: "var(--admin-error-text)", border: "var(--admin-error-border)" },
    expiring: { bg: "var(--admin-warning-bg)", color: "var(--admin-warning-text)", border: "var(--admin-warning-bg)" },
    active: { bg: "var(--admin-success-bg)", color: "var(--admin-success-text)", border: "var(--admin-success-border)" },
  };
  const c = colors[status] || colors.active;
  return { fontSize: 11, padding: "3px 8px", borderRadius: 999, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 800 };
}

function Panel({ children, style }) {
  return <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, ...style }}>{children}</div>;
}
function Banner({ message, kind }) {
  const s = kind === "success" ? { background: "var(--admin-success-bg)", color: "var(--admin-success-text)", border: "1px solid var(--admin-success-border)" } : { background: "var(--admin-error-bg)", color: "var(--admin-error-text)", border: "1px solid var(--admin-error-border)" };
  return <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...s }}>{message}</div>;
}

const primaryButton = { padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800 };
const filterBtn = { padding: "7px 14px", background: "var(--admin-bg)", color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle = { padding: "8px 10px", background: "var(--admin-bg-secondary)", borderBottom: "2px solid var(--admin-border)", textAlign: "left", fontWeight: 800, fontSize: 12, color: "var(--admin-text-muted)" };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--admin-border-light)" };
