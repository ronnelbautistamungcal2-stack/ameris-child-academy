import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ParentLayout from "@/components/parent/ParentLayout";
import { ParentEmpty } from "@/components/parent/ParentUI";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatAge } from "@/lib/ageUtils";
import { buildParentMessageComposeHref } from "@/lib/parentSupport";
import {
  BILLING_PREFERENCES,
  PAYMENT_METHODS,
  STATEMENT_STATUS,
  billingPeriodOptions,
  buildTuitionLedger,
  formatLedgerDate,
  formatLongDate,
  formatMoney,
  monthKey,
  rowsThroughPeriod,
  summarizeBilling,
} from "@/lib/tuitionBilling";

const TABS = [
  { key: "statements", label: "Billing Statements" },
  { key: "payments", label: "Payment History" },
  { key: "scheduled", label: "Scheduled Payments" },
];

export default function ParentBilling() {
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("statements");
  const [openStatement, setOpenStatement] = useState(null);

  // The ledger is generated from today, so build it once per mount rather than
  // on every render — otherwise each Date would differ and the memos below
  // would recompute forever.
  const ledger = useMemo(() => buildTuitionLedger(), []);
  const periodOptions = useMemo(
    () => billingPeriodOptions(ledger.statements),
    [ledger.statements],
  );
  const [periodKey, setPeriodKey] = useState(() => monthKey(new Date()));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [billingRes, childrenRes] = await Promise.all([
          apiJson("/api/v1/billing/summary").catch(() => ({ centers: [] })),
          apiJson("/api/v1/children"),
        ]);
        if (cancelled) return;
        setCenters(Array.isArray(billingRes?.centers) ? billingRes.centers : []);
        setChildren(
          (Array.isArray(childrenRes) ? childrenRes : []).sort((a, b) =>
            (a.firstName || "").localeCompare(b.firstName || ""),
          ),
        );
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load billing details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(
    () =>
      summarizeBilling({
        statements: ledger.statements,
        payments: ledger.payments,
        periodKey,
      }),
    [ledger.statements, ledger.payments, periodKey],
  );

  const autopayEnrolled =
    centers.some((center) => center.autopayEnabled) ||
    BILLING_PREFERENCES.autopayEnrolled;

  const billingSupportHref = buildParentMessageComposeHref({
    subject: "Billing support request",
    message:
      "Hello, I need help with tuition or account billing. Please share the next steps or a payment link when available.",
  });

  // Pay through whichever real route the center exposes; fall back to asking
  // for a payment link the same way the rest of the portal does.
  const payHref = useMemo(() => {
    const portal = centers.find((center) => center.actions?.portalUrl);
    if (portal) return portal.actions.portalUrl;
    const link = centers.find((center) => center.actions?.paymentLinkUrl);
    if (link) return link.actions.paymentLinkUrl;
    return billingSupportHref;
  }, [centers, billingSupportHref]);

  // A center that has a card on file wins over the placeholder card.
  const paymentMethods = useMemo(() => {
    const live = centers
      .filter((center) => center.cardLabel)
      .map((center) => ({
        id: center.centerId,
        brand: center.cardLabel.split(" ")[0],
        label: center.cardLabel,
        hint: center.provider
          ? `Billed through ${center.provider}`
          : center.centerName,
      }));
    if (live.length) return live;

    return PAYMENT_METHODS.map((method) => ({
      id: method.id,
      brand: method.brand,
      label: `${method.brand} •••• ${method.last4}`,
      hint: `Expires ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`,
    }));
  }, [centers]);

  const rows = useMemo(() => {
    const source =
      tab === "payments"
        ? ledger.payments
        : tab === "scheduled"
          ? ledger.scheduledPayments
          : ledger.statements;
    // Scheduled charges are all in the future, so the period filter would
    // always empty them out.
    return rowsThroughPeriod(source, tab === "scheduled" ? "" : periodKey);
  }, [tab, ledger, periodKey]);

  return (
    <ParentLayout title="Billing">
      <div className="space-y-4">
        <PageHeader
          periodKey={periodKey}
          periodOptions={periodOptions}
          onPeriod={setPeriodKey}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<StatementIcon />}
            label="Current Balance"
            value={formatMoney(summary.currentBalanceCents)}
            hint={
              summary.dueDate
                ? `Due ${formatLongDate(summary.dueDate)}`
                : "Nothing outstanding"
            }
          >
            <PayButton href={payHref} />
          </SummaryCard>

          <SummaryCard
            icon={<CalendarIcon />}
            label="Next Payment Due"
            value={summary.dueDate ? formatLongDate(summary.dueDate) : "—"}
            hint={`AutoPay: ${autopayEnrolled ? "Enrolled" : "Not Enrolled"}`}
          >
            {autopayEnrolled ? null : (
              <Link
                href={billingSupportHref}
                className="text-sm font-bold text-[#1c5fa8] hover:underline dark:text-sky-400"
              >
                Enroll in AutoPay
              </Link>
            )}
          </SummaryCard>

          <SummaryCard
            icon={<StatementIcon />}
            label="Last Payment"
            value={
              summary.lastPayment ? formatMoney(summary.lastPayment.amountCents) : "—"
            }
            hint={
              summary.lastPayment
                ? formatLongDate(summary.lastPayment.date)
                : "No payments yet"
            }
          >
            {summary.lastPayment ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <CheckIcon />
                Paid
              </span>
            ) : null}
          </SummaryCard>

          <SummaryCard
            icon={<WalletIcon />}
            label="Total Balance Due"
            value={formatMoney(summary.totalBalanceDueCents)}
          />
        </div>

        <ChildrenOnAccount roster={children} loading={loading} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.85fr)]">
          <LedgerCard
            tab={tab}
            onTab={setTab}
            rows={rows}
            roster={children}
            onView={setOpenStatement}
          />

          <div className="space-y-4">
            <PaymentMethodsCard methods={paymentMethods} manageHref={payHref} />
            <BillingSettingsCard
              autopayEnrolled={autopayEnrolled}
              enrollHref={billingSupportHref}
            />
            <BillHelpCard href="/parent/contact" />
          </div>
        </div>
      </div>

      {openStatement ? (
        <StatementDialog
          row={openStatement}
          roster={children}
          payHref={payHref}
          onClose={() => setOpenStatement(null)}
        />
      ) : null}
    </ParentLayout>
  );
}

/* ─────────────────────────── header & summary ─────────────────────────── */

function PageHeader({ periodKey, periodOptions, onPeriod }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1c5fa8] text-white">
          <CardIcon />
        </span>
        <h1 className="text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100">
          Billing
        </h1>
      </div>
      <label className="sm:w-56">
        <span className="sr-only">Billing period</span>
        <select
          value={periodKey}
          onChange={(e) => onPeriod(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          {periodOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function SummaryCard({ icon, label, value, hint, children }) {
  return (
    <section className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-[#1c5fa8] dark:bg-sky-950/60 dark:text-sky-300">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-500 dark:text-gray-400">
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100">
            {value}
          </div>
        </div>
      </div>
      {hint ? (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{hint}</div>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function PayButton({ href }) {
  const className =
    "block w-full rounded-xl bg-[#12386a] px-4 py-2.5 text-center text-sm font-extrabold text-white transition hover:bg-[#0e2b52]";

  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        Make a Payment
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      Make a Payment
    </Link>
  );
}

// Centers can hand back an https portal or a mailto: address, so anything that
// is not an in-app route leaves Next's router alone.
function isExternal(href) {
  return !String(href || "").startsWith("/");
}

/* ─────────────────────── children on account ─────────────────────── */

function ChildrenOnAccount({ roster, loading }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
        Children on Account
      </h2>
      <div className="mt-3">
        {loading ? (
          <Skeleton count={2} />
        ) : roster.length === 0 ? (
          <ParentEmpty
            title="No children linked yet"
            description="Once the center links a child to your account they will show up here."
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {roster.map((child, index) => (
              <div
                key={child.id}
                className="flex w-[116px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/70 px-2 py-3 text-center dark:border-gray-700 dark:bg-gray-900/40"
              >
                <ChildAvatar child={child} index={index} />
                <span className="w-full truncate text-[13px] font-extrabold text-[#12386a] dark:text-gray-100">
                  {child.firstName}
                </span>
                <span className="w-full truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {child.classRoom?.name || "Unassigned"}
                </span>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {formatAge(child.birthDate) || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Cycled by roster position so a child keeps the same colour across renders
// instead of flickering.
const AVATAR_TONES = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-rose-500",
];

function ChildAvatar({ child, index }) {
  const [broken, setBroken] = useState(false);
  const photo = typeof child?.photoUrl === "string" ? child.photoUrl.trim() : "";

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={`${child.firstName || "Child"} ${child.lastName || ""}`.trim()}
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-full border border-sky-100 object-cover dark:border-sky-900/60"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-black text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {initials(child?.firstName, child?.lastName)}
    </span>
  );
}

function initials(firstName, lastName) {
  const first = (firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}

/* ─────────────────────────── ledger ─────────────────────────── */

const EMPTY_COPY = {
  statements: {
    title: "No statements in this period",
    description: "Pick an earlier billing period to see older statements.",
  },
  payments: {
    title: "No payments in this period",
    description: "Payments show up here once the center records them.",
  },
  scheduled: {
    title: "No scheduled payments",
    description: "Enroll in AutoPay and upcoming charges will be listed here.",
  },
};

function LedgerCard({ tab, onTab, rows, roster, onView }) {
  const empty = EMPTY_COPY[tab];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-700">
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTab(item.key)}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 border-b-2 px-3 py-3 text-sm font-extrabold transition-colors",
                active
                  ? "border-[#1c5fa8] text-[#1c5fa8] dark:border-sky-400 dark:text-sky-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {rows.length === 0 ? (
          <ParentEmpty title={empty.title} description={empty.description} />
        ) : (
          <ResponsiveTable>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th scope="col" className="px-3 py-2.5">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Description
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Child(ren)
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      {formatLedgerDate(row.date)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-200">
                      {row.description}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {describeAppliesTo(row.appliesTo, roster)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold text-[#12386a] dark:text-gray-100">
                      {formatMoney(row.amountCents)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onView(row)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>
    </section>
  );
}

/** "All Children", or the names behind the roster positions a row carries. */
function describeAppliesTo(appliesTo, roster) {
  if (!Array.isArray(appliesTo)) return "All Children";
  const names = appliesTo
    .map((position) => roster[position]?.firstName)
    .filter(Boolean);
  return names.length ? names.join(", ") : "All Children";
}

function StatusPill({ status }) {
  const tones = {
    [STATEMENT_STATUS.PAID]:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300",
    [STATEMENT_STATUS.OPEN]:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300",
    [STATEMENT_STATUS.SCHEDULED]:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${
        tones[status] || tones[STATEMENT_STATUS.SCHEDULED]
      }`}
    >
      {status}
    </span>
  );
}

function StatementDialog({ row, roster, payHref, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${row.description} detail`}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
              {row.description}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {formatLedgerDate(row.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-extrabold text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>

        <dl className="space-y-3 px-5 py-4 text-sm">
          <DetailRow label="Amount" value={formatMoney(row.amountCents)} />
          <DetailRow
            label="Child(ren)"
            value={describeAppliesTo(row.appliesTo, roster)}
          />
          <DetailRow label="Status" value={<StatusPill status={row.status} />} />
          {row.dueDate ? (
            <DetailRow label="Due" value={formatLongDate(row.dueDate)} />
          ) : null}
        </dl>

        {row.status === STATEMENT_STATUS.OPEN ? (
          <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-700">
            <PayButton href={payHref} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-bold text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-extrabold text-[#12386a] dark:text-gray-100">{value}</dd>
    </div>
  );
}

/* ─────────────────────────── side rail ─────────────────────────── */

function SideCard({ icon, title, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-100 text-[#1c5fa8] dark:bg-sky-950/60 dark:text-sky-300">
            {icon}
          </span>
          <h2 className="text-base font-black tracking-tight text-[#12386a] dark:text-gray-100">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PaymentMethodsCard({ methods, manageHref }) {
  const addClass =
    "shrink-0 rounded-lg bg-[#1c5fa8] px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-[#12386a]";

  return (
    <SideCard
      icon={<CardIcon small />}
      title="Payment Methods"
      action={
        isExternal(manageHref) ? (
          <a href={manageHref} target="_blank" rel="noreferrer" className={addClass}>
            + Add Payment Method
          </a>
        ) : (
          <Link href={manageHref} className={addClass}>
            + Add Payment Method
          </Link>
        )
      }
    >
      <ul className="space-y-2">
        {methods.map((method) => (
          <li
            key={method.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700"
          >
            <span className="grid h-8 w-12 shrink-0 place-items-center rounded-md bg-gray-100 text-[10px] font-black uppercase tracking-wide text-[#12386a] dark:bg-gray-900 dark:text-gray-200">
              {method.brand}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-gray-800 dark:text-gray-200">
                {method.label}
              </span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                {method.hint}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </SideCard>
  );
}

function BillingSettingsCard({ autopayEnrolled, enrollHref }) {
  // Paperless and statement email have no billing-preference table yet, so
  // these hold local state and the footer points at the notification settings
  // that are actually persisted.
  const [paperless, setPaperless] = useState(BILLING_PREFERENCES.paperlessStatements);
  const [emailNotifications, setEmailNotifications] = useState(
    BILLING_PREFERENCES.emailNotifications,
  );

  return (
    <SideCard icon={<GearIcon />} title="Billing Settings">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-sm font-extrabold text-gray-800 dark:text-gray-200">
            AutoPay
          </span>
          <span className="flex items-center gap-2">
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                autopayEnrolled
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
              ].join(" ")}
            >
              {autopayEnrolled ? "Enrolled" : "Not Enrolled"}
            </span>
            {autopayEnrolled ? null : (
              <Link
                href={enrollHref}
                className="text-xs font-extrabold text-[#1c5fa8] hover:underline dark:text-sky-400"
              >
                Enroll
              </Link>
            )}
          </span>
        </div>

        <SettingToggle
          label="Paperless Statements"
          description="Receive statements electronically"
          checked={paperless}
          onChange={setPaperless}
        />
        <SettingToggle
          label="Email Notifications"
          description="Get notified when a new statement is available"
          checked={emailNotifications}
          onChange={setEmailNotifications}
        />
      </div>

      <Link
        href="/settings"
        className="mt-3 inline-block text-xs font-extrabold text-[#1c5fa8] hover:underline dark:text-sky-400"
      >
        Manage all notifications in Account Settings
      </Link>
    </SideCard>
  );
}

function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-gray-800 dark:text-gray-200">
          {label}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function BillHelpCard({ href }) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-900/20">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1c5fa8] text-sm font-black text-white">
        ?
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-[#12386a] dark:text-gray-100">
          Questions about your bill?
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Contact our office and we are happy to help.
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        Contact Us
      </Link>
    </section>
  );
}

/* ─────────────────────────── icons ─────────────────────────── */

function CardIcon({ small = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      className={small ? "h-[18px] w-[18px]" : "h-6 w-6"}
    >
      <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.5" />
      <path strokeLinecap="round" d="M2.75 9.75h18.5M6.25 15h3.5" />
    </svg>
  );
}

function StatementIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 8.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.5L19 8.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13h7M8.5 16.5h5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      className="h-5 w-5"
    >
      <rect x="3.25" y="5" width="17.5" height="15.5" rx="2.5" />
      <path strokeLinecap="round" d="M3.25 9.5h17.5M8 3.25v3.5M16 3.25v3.5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.25 8.5A2.25 2.25 0 0 1 5.5 6.25h13A2.25 2.25 0 0 1 20.75 8.5v9a2.25 2.25 0 0 1-2.25 2.25h-13A2.25 2.25 0 0 1 3.25 17.5z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6.25 14 3.5 7.5 6.25M16.25 13h1.5"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-[18px] w-[18px]"
    >
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.1 14a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.05a1.5 1.5 0 0 0-2.59 1.06V20a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.59-1.02l-.06.05a1.8 1.8 0 1 1-2.55-2.55l.05-.06A1.5 1.5 0 0 0 4.4 13.8H4.3a1.8 1.8 0 1 1 0-3.6h.1A1.5 1.5 0 0 0 5.46 7.6l-.05-.06a1.8 1.8 0 1 1 2.55-2.55l.06.05A1.5 1.5 0 0 0 10.6 4.4V4.3a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.59 1.02l.06-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.06A1.5 1.5 0 0 0 19.6 10.2H20a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-.8.2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.1 14.2-4-4 1.55-1.55 2.45 2.45 5.2-5.2L17.65 9.5l-6.75 6.7z" />
    </svg>
  );
}
