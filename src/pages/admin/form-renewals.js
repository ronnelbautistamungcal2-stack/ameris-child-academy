import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── tiny helpers ─────────────────────────────────────────── */

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function statusOf(s) {
  if (!s.expiresAt) return "none";
  const days = daysUntil(s.expiresAt);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

/* ── icons ────────────────────────────────────────────────── */

function SvgIcon({ children, size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

function IconFileText(p) {
  return (
    <SvgIcon {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </SvgIcon>
  );
}

function IconRefresh(p) {
  return (
    <SvgIcon {...p}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </SvgIcon>
  );
}

function IconAlertTriangle(p) {
  return (
    <SvgIcon {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </SvgIcon>
  );
}

function IconClock(p) {
  return (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </SvgIcon>
  );
}

function IconCheckCircle(p) {
  return (
    <SvgIcon {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </SvgIcon>
  );
}

function IconXCircle(p) {
  return (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </SvgIcon>
  );
}

function IconSearch(p) {
  return (
    <SvgIcon {...p}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </SvgIcon>
  );
}

function IconX(p) {
  return (
    <SvgIcon {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </SvgIcon>
  );
}

function IconChevronLeft(p) {
  return (
    <SvgIcon {...p}>
      <polyline points="15 18 9 12 15 6" />
    </SvgIcon>
  );
}

function IconChevronRight(p) {
  return (
    <SvgIcon {...p}>
      <polyline points="9 18 15 12 9 6" />
    </SvgIcon>
  );
}

function IconUser(p) {
  return (
    <SvgIcon {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </SvgIcon>
  );
}

function IconCalendar(p) {
  return (
    <SvgIcon {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </SvgIcon>
  );
}

function IconEye(p) {
  return (
    <SvgIcon {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}

function IconBell(p) {
  return (
    <SvgIcon {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </SvgIcon>
  );
}

/* ── sub-components ───────────────────────────────────────── */

function StatCard({ label, value, sublabel, icon: Icon, iconBg, iconColor }) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 14,
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
        e.currentTarget.style.borderColor = "var(--admin-text-faint)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--admin-border)";
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--admin-text-muted)" }}>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--admin-text)", lineHeight: 1 }}>
          {value}
        </div>
        {sublabel ? (
          <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 4 }}>{sublabel}</div>
        ) : null}
      </div>
      {Icon ? (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: iconBg || "var(--admin-bg-tertiary)",
            color: iconColor || "var(--admin-text-muted)",
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
      ) : null}
    </div>
  );
}

function Badge({ status }) {
  const config = {
    expired: {
      bg: "var(--admin-error-bg)",
      color: "var(--admin-error-text)",
      border: "var(--admin-error-border)",
      label: "Expired",
      Icon: IconXCircle,
    },
    expiring: {
      bg: "var(--admin-warning-bg)",
      color: "var(--admin-warning-text)",
      border: "var(--admin-warning-bg)",
      label: "Expiring Soon",
      Icon: IconAlertTriangle,
    },
    active: {
      bg: "var(--admin-success-bg)",
      color: "var(--admin-success-text)",
      border: "var(--admin-success-border)",
      label: "Active",
      Icon: IconCheckCircle,
    },
    none: {
      bg: "var(--admin-bg-tertiary)",
      color: "var(--admin-text-muted)",
      border: "var(--admin-border)",
      label: "No Expiry",
      Icon: null,
    },
  };
  const c = config[status] || config.active;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {c.Icon ? <c.Icon size={12} /> : null}
      {c.label}
    </span>
  );
}

function Panel({ children, style }) {
  return (
    <div
      style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        borderRadius: 14,
        padding: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Banner({ message, kind, onDismiss }) {
  const isSuccess = kind === "success";
  const Icon = isSuccess ? IconCheckCircle : IconXCircle;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        borderRadius: 12,
        marginTop: 12,
        background: isSuccess ? "var(--admin-success-bg)" : "var(--admin-error-bg)",
        color: isSuccess ? "var(--admin-success-text)" : "var(--admin-error-text)",
        border: `1px solid ${isSuccess ? "var(--admin-success-border)" : "var(--admin-error-border)"}`,
        fontSize: 13,
      }}
    >
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{isSuccess ? "Success" : "Error"}</div>
        <div style={{ marginTop: 2 }}>{message}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            opacity: 0.5,
            padding: 2,
            flexShrink: 0,
          }}
        >
          <IconX size={16} />
        </button>
      ) : null}
    </div>
  );
}

function DetailsModal({ record, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!record) return null;

  const status = statusOf(record);
  const days = daysUntil(record.expiresAt);
  const childName = record.child
    ? `${record.child.firstName} ${record.child.lastName || ""}`.trim()
    : "—";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--admin-modal-overlay, rgba(0,0,0,0.5))",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--admin-bg)",
          border: "1px solid var(--admin-border)",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--admin-border-light)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--admin-text)" }}>
            Form Submission Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--admin-text-muted)",
              padding: 4,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: 20 }}>
          {/* Title + Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>
              {record.template?.title || "Unknown Form"}
            </span>
            <Badge status={status} />
          </div>

          {/* Days indicator */}
          {record.expiresAt && days !== null ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: status === "expired"
                  ? "var(--admin-error-bg)"
                  : status === "expiring"
                    ? "var(--admin-warning-bg)"
                    : "var(--admin-success-bg)",
                color: status === "expired"
                  ? "var(--admin-error-text)"
                  : status === "expiring"
                    ? "var(--admin-warning-text)"
                    : "var(--admin-success-text)",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IconClock size={16} />
              {status === "expired"
                ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`
                : `Expires in ${days} day${days !== 1 ? "s" : ""}`}
            </div>
          ) : null}

          {/* Info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 16,
            }}
          >
            {[
              { icon: IconUser, label: "Child", value: childName },
              { icon: IconUser, label: "Submitted By", value: record.submittedBy?.name || record.submittedBy?.email || "—" },
              { icon: IconCalendar, label: "Submitted", value: fmt(record.createdAt) },
              { icon: IconCalendar, label: "Expires", value: fmt(record.expiresAt) },
            ].map(({ icon: IC, label, value }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--admin-bg-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--admin-text-muted)",
                  }}
                >
                  <IC size={15} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--admin-text-muted)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", marginTop: 2 }}>
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Renewal period info */}
          {record.template?.renewalPeriodDays ? (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--admin-bg-secondary)",
                border: "1px solid var(--admin-border-light)",
                fontSize: 13,
                color: "var(--admin-text-secondary)",
              }}
            >
              Renewal period: <strong>{record.template.renewalPeriodDays} days</strong>
            </div>
          ) : null}
        </div>

        {/* Modal footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 20px",
            borderTop: "1px solid var(--admin-border-light)",
            background: "var(--admin-bg-secondary)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-bg)",
              color: "var(--admin-text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ count = 5 }) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={i}>
      {[180, 120, 130, 90, 90, 80, 40].map((w, ci) => (
        <td key={ci} style={tdBase}>
          <div
            style={{
              height: 14,
              width: w,
              maxWidth: "100%",
              borderRadius: 6,
              background: "var(--admin-bg-tertiary)",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.05}s`,
            }}
          />
        </td>
      ))}
    </tr>
  ));
}

/* ── main component ───────────────────────────────────────── */

export default function FormRenewals() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [checking, setChecking] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState(null);
  const pageSize = 10;

  const refresh = useCallback(async () => {
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
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  async function runCheck() {
    setChecking(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiJson("/api/v1/forms/renewals/check", { method: "POST" });
      const parts = [];
      if (result.summary?.expiringSoon) parts.push(`${result.summary.expiringSoon} expiring soon`);
      if (result.summary?.expired) parts.push(`${result.summary.expired} expired`);
      setSuccess(
        `Renewal check complete. ${result.created || 0} notification${result.created !== 1 ? "s" : ""} sent.` +
        (parts.length ? ` Found: ${parts.join(", ")}.` : ""),
      );
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to run renewal check");
    } finally {
      setChecking(false);
    }
  }

  const counts = useMemo(() => {
    let expiring = 0, expired = 0, active = 0;
    for (const s of submissions) {
      const st = statusOf(s);
      if (st === "expired") expired++;
      else if (st === "expiring") expiring++;
      else if (st === "active") active++;
    }
    return { expiring, expired, active, total: submissions.length };
  }, [submissions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase().trim();
    return submissions.filter((s) => {
      const hay = [
        s.template?.title,
        s.child?.firstName,
        s.child?.lastName,
        s.submittedBy?.name,
        s.submittedBy?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [submissions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const filterTabs = [
    { key: "all", label: "All", count: counts.total },
    { key: "expiring", label: "Expiring Soon", count: counts.expiring },
    { key: "expired", label: "Expired", count: counts.expired },
  ];

  return (
    <AdminLayout title="Form Renewals">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Header ─────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                flexShrink: 0,
              }}
            >
              <IconFileText size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--admin-text)" }}>
                Form Renewals
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)" }}>
                Track form expirations and send renewal reminders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={runCheck}
            disabled={checking}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 10,
              cursor: checking ? "wait" : "pointer",
              fontWeight: 700,
              fontSize: 13,
              opacity: checking ? 0.7 : 1,
              transition: "opacity 0.15s, background 0.15s",
              boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
            }}
            onMouseEnter={(e) => { if (!checking) e.currentTarget.style.background = "#1d4ed8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#2563eb"; }}
          >
            <IconBell size={16} style={checking ? { animation: "spin 1s linear infinite" } : {}} />
            {checking ? "Checking..." : "Run Renewal Check"}
          </button>
        </div>

        {/* ── Banners ────────────────────────────────── */}
        {error ? <Banner kind="error" message={error} onDismiss={() => setError("")} /> : null}
        {success ? <Banner kind="success" message={success} onDismiss={() => setSuccess("")} /> : null}

        {/* ── Stat cards ─────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <StatCard
            label="Expiring Soon"
            value={counts.expiring}
            sublabel="Within 30 days"
            icon={IconAlertTriangle}
            iconBg="var(--admin-warning-bg)"
            iconColor="var(--admin-warning-text)"
          />
          <StatCard
            label="Expired"
            value={counts.expired}
            sublabel="Needs renewal"
            icon={IconXCircle}
            iconBg="var(--admin-error-bg)"
            iconColor="var(--admin-error-text)"
          />
          <StatCard
            label="Active"
            value={counts.active}
            sublabel="Up to date"
            icon={IconCheckCircle}
            iconBg="var(--admin-success-bg)"
            iconColor="var(--admin-success-text)"
          />
          <StatCard
            label="Total Forms"
            value={counts.total}
            sublabel="With renewal tracking"
            icon={IconFileText}
            iconBg="var(--admin-info-bg)"
            iconColor="var(--admin-info-text)"
          />
        </div>

        {/* ── Filter + Search bar ────────────────────── */}
        <Panel>
          <div style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 4, background: "var(--admin-bg-secondary)", borderRadius: 8, padding: 3 }}>
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: filter === t.key ? "var(--admin-bg)" : "transparent",
                    color: filter === t.key ? "var(--admin-text)" : "var(--admin-text-muted)",
                    boxShadow: filter === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t.label}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 20,
                      height: 20,
                      padding: "0 6px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: filter === t.key ? "#2563eb" : "var(--admin-bg-tertiary)",
                      color: filter === t.key ? "white" : "var(--admin-text-muted)",
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: "relative", minWidth: 220 }}>
              <IconSearch
                size={16}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--admin-text-faint)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search forms, children, users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 32px 8px 32px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid var(--admin-border)",
                  background: "var(--admin-bg)",
                  color: "var(--admin-text)",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(37,99,235,0.15)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--admin-text-faint)",
                    padding: 2,
                    display: "flex",
                  }}
                >
                  <IconX size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {/* Results count bar */}
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--admin-border-light)",
              borderBottom: "1px solid var(--admin-border-light)",
              background: "var(--admin-bg-secondary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "var(--admin-text-muted)",
            }}
          >
            <span>
              Showing <strong style={{ color: "var(--admin-text)" }}>{filtered.length ? (page - 1) * pageSize + 1 : 0}</strong>
              {" – "}
              <strong style={{ color: "var(--admin-text)" }}>{Math.min(page * pageSize, filtered.length)}</strong>
              {" of "}
              <strong style={{ color: "var(--admin-text)" }}>{filtered.length}</strong>
              {" results"}
            </span>
          </div>

          {/* ── Table ──────────────────────────────── */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Form", "Child", "Submitted By", "Submitted", "Expires", "Status", ""].map((h) => (
                    <th key={h} style={thBase}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows count={5} />
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: "50%",
                            background: "var(--admin-bg-tertiary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--admin-text-faint)",
                          }}
                        >
                          <IconFileText size={28} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text-secondary)" }}>
                          No forms found
                        </div>
                        <div style={{ fontSize: 12, color: "var(--admin-text-muted)", maxWidth: 300 }}>
                          {search
                            ? "Try adjusting your search terms."
                            : filter !== "all"
                              ? "No forms match this filter. Try selecting \"All\"."
                              : "No forms with renewal tracking have been submitted yet."}
                        </div>
                        {(search || filter !== "all") ? (
                          <button
                            type="button"
                            onClick={() => { setSearch(""); setFilter("all"); }}
                            style={{
                              marginTop: 4,
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid var(--admin-border)",
                              background: "var(--admin-bg)",
                              color: "var(--admin-text-secondary)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((s) => {
                    const status = statusOf(s);
                    const days = daysUntil(s.expiresAt);
                    return (
                      <tr
                        key={s.id}
                        style={{ cursor: "pointer", transition: "background 0.1s" }}
                        onClick={() => setDetailRecord(s)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--admin-accent-bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={tdBase}>
                          <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>
                            {s.template?.title || "—"}
                          </div>
                          {s.template?.renewalPeriodDays ? (
                            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>
                              {s.template.renewalPeriodDays}-day renewal
                            </div>
                          ) : null}
                        </td>
                        <td style={tdBase}>
                          {s.child ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: "var(--admin-bg-tertiary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--admin-text-faint)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {(s.child.firstName?.[0] || "").toUpperCase()}
                              </div>
                              <span style={{ color: "var(--admin-text-secondary)" }}>
                                {s.child.firstName} {s.child.lastName || ""}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--admin-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdBase, color: "var(--admin-text-secondary)" }}>
                          {s.submittedBy?.name || s.submittedBy?.email || "—"}
                        </td>
                        <td style={{ ...tdBase, color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
                          {fmt(s.createdAt)}
                        </td>
                        <td style={tdBase}>
                          <div style={{ whiteSpace: "nowrap", color: "var(--admin-text-secondary)" }}>
                            {fmt(s.expiresAt)}
                          </div>
                          {days !== null && s.expiresAt ? (
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                                color: status === "expired"
                                  ? "var(--admin-error-text)"
                                  : status === "expiring"
                                    ? "var(--admin-warning-text)"
                                    : "var(--admin-text-faint)",
                                fontWeight: 600,
                              }}
                            >
                              {status === "expired"
                                ? `${Math.abs(days)}d overdue`
                                : `${days}d remaining`}
                            </div>
                          ) : null}
                        </td>
                        <td style={tdBase}>
                          <Badge status={status} />
                        </td>
                        <td style={{ ...tdBase, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setDetailRecord(s)}
                            style={{
                              background: "none",
                              border: "1px solid var(--admin-border)",
                              borderRadius: 6,
                              cursor: "pointer",
                              padding: "4px 6px",
                              display: "inline-flex",
                              color: "var(--admin-text-muted)",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#2563eb";
                              e.currentTarget.style.color = "#2563eb";
                              e.currentTarget.style.background = "var(--admin-accent-bg)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--admin-border)";
                              e.currentTarget.style.color = "var(--admin-text-muted)";
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <IconEye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────── */}
          {totalPages > 1 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderTop: "1px solid var(--admin-border-light)",
                fontSize: 12,
                color: "var(--admin-text-muted)",
              }}
            >
              <span>
                Page <strong style={{ color: "var(--admin-text)" }}>{page}</strong> of{" "}
                <strong style={{ color: "var(--admin-text)" }}>{totalPages}</strong>
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={paginationBtn(page <= 1)}
                >
                  <IconChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let n;
                  if (totalPages <= 5) {
                    n = i + 1;
                  } else if (page <= 3) {
                    n = i + 1;
                  } else if (page >= totalPages - 2) {
                    n = totalPages - 4 + i;
                  } else {
                    n = page - 2 + i;
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: n === page ? "1px solid #2563eb" : "1px solid transparent",
                        background: n === page ? "#2563eb" : "transparent",
                        color: n === page ? "white" : "var(--admin-text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={paginationBtn(page >= totalPages)}
                >
                  Next <IconChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      {/* ── Details Modal ──────────────────────────── */}
      {detailRecord ? (
        <DetailsModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      ) : null}

      {/* pulse animation for skeleton */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AdminLayout>
  );
}

/* ── shared inline styles ─────────────────────────────────── */

const thBase = {
  padding: "10px 14px",
  background: "var(--admin-bg-secondary)",
  borderBottom: "2px solid var(--admin-border)",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "var(--admin-text-muted)",
  whiteSpace: "nowrap",
};

const tdBase = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--admin-border-light)",
  verticalAlign: "top",
};

function paginationBtn(disabled) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-bg)",
    color: disabled ? "var(--admin-text-faint)" : "var(--admin-text-secondary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
