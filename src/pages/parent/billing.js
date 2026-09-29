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
        setCenters(
          Array.isArray(billingRes?.centers) ? billingRes.centers : [],
        );
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
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <PageHeader
            periodKey={periodKey}
            periodOptions={periodOptions}
            onPeriod={setPeriodKey}
          />

          <div className="space-y-3 p-3 sm:p-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={<StatementIcon />}
                label="Current Balance"
                value={formatMoney(summary.currentBalanceCents)}
                hint={
                  summary.dueDate
                    ? `Due ${formatLongDate(summary.dueDate)}`
                    : "Nothing outstanding"
                }
                footer={<PayButton href={payHref} />}
              />

              <SummaryCard
                icon={<CalendarIcon />}
                label="Next Payment Due"
                value={summary.dueDate ? formatLongDate(summary.dueDate) : "—"}
                hint={`AutoPay: ${autopayEnrolled ? "Enrolled" : "Not Enrolled"}`}
              >
                {autopayEnrolled ? null : (
                  <Link
                    href={billingSupportHref}
                    className="text-[13px] font-semibold text-[#1a6fd6] hover:underline dark:text-sky-400"
                  >
                    Enroll in AutoPay
                  </Link>
                )}
              </SummaryCard>

              <SummaryCard
                icon={<StatementIcon />}
                label="Last Payment"
                value={
                  summary.lastPayment
                    ? formatMoney(summary.lastPayment.amountCents)
                    : "—"
                }
                hint={
                  summary.lastPayment
                    ? formatLongDate(summary.lastPayment.date)
                    : "No payments yet"
                }
              >
                {summary.lastPayment ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckIcon />
                    Paid
                  </span>
                ) : null}
              </SummaryCard>

              <SummaryCard
                icon={<MoneyBagIcon />}
                label="Total Balance Due"
                value={formatMoney(summary.totalBalanceDueCents)}
              />
            </div>

            <ChildrenOnAccount roster={children} loading={loading} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
            >
              <BillHelpCard href="/parent/contact" />
            </BillingSettingsCard>
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
    <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3.5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1a6fd6] text-white shadow-sm">
          <CardIcon />
        </span>
        <h1 className="text-[26px] font-black tracking-tight text-[#0f2d57] dark:text-gray-100">
          Billing
        </h1>
      </div>
      <label className="relative sm:w-[168px]">
        <span className="sr-only">Billing period</span>
        <select
          value={periodKey}
          onChange={(e) => onPeriod(e.target.value)}
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3.5 pr-9 text-sm font-semibold text-gray-800 shadow-sm focus:border-[#1a6fd6] focus:outline-none focus:ring-2 focus:ring-[#1a6fd6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          {periodOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon />
      </label>
    </div>
  );
}

/** `children` sit under the value like the hint; `footer` spans the card. */
function SummaryCard({ icon, label, value, hint, children, footer }) {
  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f1fc] text-[#1a6fd6] dark:bg-sky-950/60 dark:text-sky-300">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
            {label}
          </div>
          <div className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight text-[#0f2d57] dark:text-gray-100">
            {value}
          </div>
          {hint ? (
            <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
              {hint}
            </div>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}

function PayButton({ href }) {
  const className =
    "block w-full rounded-lg bg-[#0f2d57] px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#0a2042]";

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
    <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-base font-extrabold tracking-tight text-[#0f2d57] dark:text-gray-100">
        Children on Account
      </h2>
      <div className="mt-2.5">
        {loading ? (
          <Skeleton count={2} />
        ) : roster.length === 0 ? (
          <ParentEmpty
            title="No children linked yet"
            description="Once the center links a child to your account they will show up here."
          />
        ) : (
          // auto-fill keeps the empty tracks, so a short roster keeps tiles at
          // the mockup's width instead of stretching a few across the row.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
            {roster.map((child, index) => (
              <div
                key={child.id}
                className="flex min-w-0 flex-col items-center rounded-lg bg-[#f4f6f9] px-2 pb-2.5 pt-2 text-center dark:bg-gray-900/50"
              >
                <ChildAvatar child={child} index={index} />
                <span className="mt-1.5 w-full truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                  {child.firstName}
                </span>
                <span className="w-full truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {child.classRoom?.name || "Unassigned"}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
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
  "bg-[#1b8ad8]",
  "bg-[#4f9786]",
  "bg-[#8c5ad6]",
  "bg-[#5a9be2]",
  "bg-[#2474c4]",
  "bg-[#3db6e2]",
  "bg-[#f5a45c]",
  "bg-[#7ca6e6]",
];

function ChildAvatar({ child, index }) {
  const [broken, setBroken] = useState(false);
  const photo =
    typeof child?.photoUrl === "string" ? child.photoUrl.trim() : "";

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={`${child.firstName || "Child"} ${child.lastName || ""}`.trim()}
        onError={() => setBroken(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
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
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-3 dark:border-gray-700 sm:px-4">
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTab(item.key)}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 border-b-2 px-4 py-3.5 text-[13px] transition-colors",
                active
                  ? "border-[#1a6fd6] font-bold text-[#0f2d57] dark:border-sky-400 dark:text-sky-300"
                  : "border-transparent font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 sm:p-4">
        {rows.length === 0 ? (
          <ParentEmpty title={empty.title} description={empty.description} />
        ) : (
          <ResponsiveTable>
            <table className="min-w-full overflow-hidden rounded-lg text-[13px] ring-1 ring-gray-200 dark:ring-gray-700">
              <thead>
                <tr className="bg-[#eef1f5] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-600 dark:bg-gray-900/60 dark:text-gray-400">
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
                  <th scope="col" className="px-3 py-2.5 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-800 dark:text-gray-300">
                      {formatLedgerDate(row.date)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">
                      {row.description}
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-300">
                      {describeAppliesTo(row.appliesTo, roster)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-800 dark:text-gray-100">
                      {formatMoney(row.amountCents)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onView(row)}
                        className="w-20 rounded-md border border-gray-300 bg-white py-1.5 text-[13px] font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
      "bg-[#dff3e5] text-[#1e7a3c] dark:bg-emerald-900/30 dark:text-emerald-300",
    [STATEMENT_STATUS.OPEN]:
      "bg-[#fde2e2] text-[#d42f2f] dark:bg-rose-900/30 dark:text-rose-300",
    [STATEMENT_STATUS.SCHEDULED]:
      "bg-[#e3effc] text-[#1a6fd6] dark:bg-sky-900/30 dark:text-sky-300",
  };
  return (
    <span
      className={`inline-flex min-w-[76px] justify-center rounded-md px-3 py-1 text-[13px] font-medium ${
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
          <DetailRow
            label="Status"
            value={<StatusPill status={row.status} />}
          />
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
      <dd className="font-extrabold text-[#12386a] dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────── side rail ─────────────────────────── */

function SideCard({ icon, title, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-[#1a6fd6] dark:text-sky-400">
            {icon}
          </span>
          <h2 className="truncate text-[15px] font-extrabold tracking-tight text-[#0f2d57] dark:text-gray-100">
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
    "inline-flex shrink-0 items-center gap-1 rounded-md border border-[#1a6fd6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a6fd6] transition hover:bg-[#eef5fd] dark:border-sky-500 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40";
  const addLabel = (
    <>
      <span aria-hidden="true" className="text-sm leading-none">
        +
      </span>
      Add Payment Method
    </>
  );

  return (
    <SideCard
      icon={<CardIcon small />}
      title="Payment Methods"
      action={
        isExternal(manageHref) ? (
          <a
            href={manageHref}
            target="_blank"
            rel="noreferrer"
            className={addClass}
          >
            {addLabel}
          </a>
        ) : (
          <Link href={manageHref} className={addClass}>
            {addLabel}
          </Link>
        )
      }
    >
      <ul className="space-y-2">
        {methods.map((method) => (
          <li
            key={method.id}
            className="flex items-center gap-4 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <BrandMark brand={method.brand} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-gray-900 dark:text-gray-200">
                {method.label}
              </span>
              <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                {method.hint}
              </span>
            </span>
            <MethodMenu manageHref={manageHref} label={method.label} />
          </li>
        ))}
      </ul>
    </SideCard>
  );
}

function BrandMark({ brand }) {
  if (/^visa$/i.test(brand || "")) {
    return (
      <span className="w-12 shrink-0 text-center text-[22px] font-black italic leading-none tracking-tight text-[#1a1f71] dark:text-gray-100">
        VISA
      </span>
    );
  }
  return (
    <span className="grid h-8 w-12 shrink-0 place-items-center rounded-md bg-gray-100 text-[10px] font-black uppercase tracking-wide text-[#0f2d57] dark:bg-gray-900 dark:text-gray-200">
      {brand}
    </span>
  );
}

/** The ⋮ menu on a saved card; managing it happens wherever payments do. */
function MethodMenu({ manageHref, label }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const itemClass =
    "block w-full px-3 py-2 text-left text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="grid h-8 w-6 place-items-center rounded-md text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <KebabIcon />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {isExternal(manageHref) ? (
            <a
              role="menuitem"
              href={manageHref}
              target="_blank"
              rel="noreferrer"
              className={itemClass}
            >
              Manage payment method
            </a>
          ) : (
            <Link role="menuitem" href={manageHref} className={itemClass}>
              Manage payment method
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Paperless and statement email have no billing-preference table yet, so the
// choice is remembered in this browser only.
const PREFS_STORAGE_KEY = "ameris.billingPrefs";

function readStoredPrefs() {
  try {
    return (
      JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) || "{}") || {}
    );
  } catch {
    return {};
  }
}

function useStoredPreference(name, fallback) {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const saved = readStoredPrefs()[name];
    if (typeof saved === "boolean") setValue(saved);
  }, [name]);

  const update = (next) => {
    setValue(next);
    try {
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({ ...readStoredPrefs(), [name]: next }),
      );
    } catch {
      // Storage can be blocked; the toggle still reflects the choice.
    }
  };

  return [value, update];
}

function BillingSettingsCard({ autopayEnrolled, enrollHref, children }) {
  const [paperless, setPaperless] = useStoredPreference(
    "paperlessStatements",
    BILLING_PREFERENCES.paperlessStatements,
  );
  const [emailNotifications, setEmailNotifications] = useStoredPreference(
    "emailNotifications",
    BILLING_PREFERENCES.emailNotifications,
  );

  return (
    <SideCard icon={<GearIcon />} title="Billing Settings">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <div className="flex items-center justify-between gap-3 pb-2.5">
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-200">
            AutoPay
          </span>
          <span className="flex items-center gap-2.5">
            <span
              className={[
                "rounded-md px-2 py-1 text-xs",
                autopayEnrolled
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
              ].join(" ")}
            >
              {autopayEnrolled ? "Enrolled" : "Not Enrolled"}
            </span>
            {autopayEnrolled ? null : (
              <Link
                href={enrollHref}
                className="text-[13px] font-medium text-[#1a6fd6] hover:underline dark:text-sky-400"
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

      {children ? <div className="mt-2">{children}</div> : null}
    </SideCard>
  );
}

function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-gray-900 dark:text-gray-200">
          {label}
        </span>
        <span className="block text-[11px] text-gray-600 dark:text-gray-400">
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
          checked ? "bg-[#1f9a4a]" : "bg-gray-300 dark:bg-gray-600",
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
    <div className="flex items-center gap-3 rounded-lg bg-[#e9f2fc] px-3.5 py-3 dark:bg-sky-900/20">
      <span className="grid h-6 w-6 shrink-0 place-items-center self-start rounded-full bg-[#1a6fd6] text-xs font-black text-white">
        ?
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          Questions about your bill?
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-400">
          Contact our office and we&apos;re happy to help.
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-md border border-[#1a6fd6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1a6fd6] transition hover:bg-[#eef5fd] dark:border-sky-500 dark:bg-transparent dark:text-sky-300"
      >
        Contact Us
      </Link>
    </div>
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
      className={small ? "h-5 w-5" : "h-6 w-6"}
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
      className="h-6 w-6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 8.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.5L19 8.5z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 13h7M8.5 16.5h5"
      />
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
      className="h-6 w-6"
    >
      <rect x="3.25" y="5" width="17.5" height="15.5" rx="2.5" />
      <path strokeLinecap="round" d="M3.25 9.5h17.5M8 3.25v3.5M16 3.25v3.5" />
    </svg>
  );
}

function MoneyBagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.25 6.75h5.5M9.5 6.75 7.75 3.5c1.4.6 2.8.6 4.25 0 1.45.6 2.85.6 4.25 0L14.5 6.75"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.25 6.75C6.4 8.6 4.5 11.6 4.5 14.9c0 3.4 2.6 5.6 7.5 5.6s7.5-2.2 7.5-5.6c0-3.3-1.9-6.3-4.75-8.15"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.9 11.4c-.35-.6-1.05-.95-1.9-.95-1.1 0-1.9.6-1.9 1.4 0 1.9 3.85 1 3.85 2.9 0 .8-.85 1.45-1.95 1.45-.9 0-1.65-.4-1.95-1.05M12 9.4v1.05M12 16.2v1.05"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5.5 7.75 4.5 4.5 4.5-4.5"
      />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="12" cy="5.5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="18.5" r="1.75" />
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
      className="h-5 w-5"
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
