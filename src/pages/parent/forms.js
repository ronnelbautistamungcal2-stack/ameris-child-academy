import ParentLayout from "@/components/parent/ParentLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import {
  ageInMonths,
  childMatchesAgeGroup,
  describeAssignment,
  formatAgeMonths,
  normalizeAssignmentType,
} from "@/lib/formAssignments";
import { useCallback, useEffect, useMemo, useState } from "react";

const DAY = 86400000;
const RENEWAL_WINDOW_DAYS = 30;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/* ─────────────────────────── status model ─────────────────────────── */

const STATUS_ORDER = ["ACTION_REQUIRED", "NOT_STARTED", "SUBMITTED", "COMPLETED"];

const STATUS_META = {
  COMPLETED: {
    label: "Completed",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300",
    icon: "check",
  },
  SUBMITTED: {
    label: "In Review",
    pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300",
    icon: "clock",
  },
  ACTION_REQUIRED: {
    label: "Action Required",
    pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300",
    icon: "alert",
  },
  NOT_STARTED: {
    label: "Not Started",
    pill: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
    icon: "clock",
  },
};

/* ─────────────────────────── page ─────────────────────────── */

export default function ParentForms() {
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [children, setChildren] = useState([]);
  const [pendingPlans, setPendingPlans] = useState([]);
  const [approvingPlanId, setApprovingPlanId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tab, setTab] = useState("required");
  const [schoolYear, setSchoolYear] = useState(() => currentSchoolYearStart());
  const [scopeKey, setScopeKey] = useState("family");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeForm, setActiveForm] = useState(null);

  const loadPendingPlans = useCallback(async () => {
    try {
      const plans = await apiJson("/api/v1/behavior-plans?status=ACTIVE");
      setPendingPlans(Array.isArray(plans) ? plans.filter((p) => !p.parentApproved) : []);
    } catch {
      /* progress plans are extra context here, not the point of the page */
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [t, s, kids] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/forms/submissions"),
        apiJson("/api/v1/children"),
      ]);
      setTemplates(Array.isArray(t) ? t.filter((item) => item.active !== false) : []);
      setSubmissions(Array.isArray(s) ? s : []);
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadPendingPlans();
  }, [refresh, loadPendingPlans]);

  async function approvePlan(planId) {
    setApprovingPlanId(planId);
    try {
      await apiJson(`/api/v1/behavior-plans/${planId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadPendingPlans();
    } catch (e) {
      setError(e.message || "Failed to approve plan");
    } finally {
      setApprovingPlanId("");
    }
  }

  // Only paperwork filed during the chosen school year counts toward this
  // year's status; older records stay readable under Submission History.
  const yearRange = useMemo(() => schoolYearRange(schoolYear), [schoolYear]);
  const yearSubmissions = useMemo(
    () =>
      submissions.filter((item) => {
        const created = new Date(item.createdAt).getTime();
        return created >= yearRange.from && created < yearRange.to;
      }),
    [submissions, yearRange],
  );

  const scopes = useMemo(() => buildScopes(children), [children]);

  useEffect(() => {
    if (scopes.some((scope) => scope.key === scopeKey)) return;
    setScopeKey(scopes[0]?.key || "family");
  }, [scopes, scopeKey]);

  const rowsByScope = useMemo(() => {
    const now = Date.now();
    const map = new Map();
    for (const scope of scopes) {
      map.set(
        scope.key,
        templatesForScope(templates, scope).map((template) =>
          buildRow(template, latestSubmission(yearSubmissions, template.id, scope.child?.id), now),
        ),
      );
    }
    return map;
  }, [scopes, templates, yearSubmissions]);

  const activeScope = scopes.find((scope) => scope.key === scopeKey) || scopes[0] || null;
  const scopeRows = rowsByScope.get(activeScope?.key) || [];

  const visibleRows = useMemo(
    () =>
      statusFilter === "all" ? scopeRows : scopeRows.filter((row) => row.status === statusFilter),
    [scopeRows, statusFilter],
  );

  function openForm(row, mode) {
    setSuccess("");
    setError("");
    setActiveForm({ row, scope: activeScope, mode });
  }

  async function handleSubmitted(message) {
    setActiveForm(null);
    setSuccess(message);
    await refresh();
  }

  return (
    <ParentLayout title="Forms & Renewals">
      <div className="space-y-4">
        <PageHeader schoolYear={schoolYear} onSchoolYear={setSchoolYear} />

        <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { key: "required", label: "Required Forms" },
            { key: "history", label: "Submission History" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={[
                "-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-extrabold transition",
                tab === item.key
                  ? "border-[#1c5fa8] text-[#1c5fa8] dark:border-sky-400 dark:text-sky-300"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? <Banner tone="rose">{error}</Banner> : null}
        {success ? <Banner tone="emerald">{success}</Banner> : null}

        {tab === "required" ? (
          <>
            <InfoNote />

            {pendingPlans.length > 0 ? (
              <PendingPlans
                plans={pendingPlans}
                approvingPlanId={approvingPlanId}
                onApprove={approvePlan}
              />
            ) : null}

            <section>
              <h2 className="mb-2 text-sm font-extrabold text-[#12386a] dark:text-gray-100">
                Select a Child or Family
              </h2>
              {loading ? (
                <Skeleton count={1} />
              ) : (
                <ScopePicker
                  scopes={scopes}
                  activeKey={activeScope?.key}
                  rowsByScope={rowsByScope}
                  onSelect={(key) => {
                    setScopeKey(key);
                    setStatusFilter("all");
                  }}
                />
              )}
            </section>

            <FormsTable
              loading={loading}
              scope={activeScope}
              rows={visibleRows}
              totalRows={scopeRows.length}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              onOpen={openForm}
            />
          </>
        ) : (
          <SubmissionHistory loading={loading} submissions={submissions} />
        )}
      </div>

      {activeForm ? (
        <FormModal
          row={activeForm.row}
          scope={activeForm.scope}
          mode={activeForm.mode}
          onClose={() => setActiveForm(null)}
          onSubmitted={handleSubmitted}
        />
      ) : null}
    </ParentLayout>
  );
}

/* ─────────────────────────── header & chrome ─────────────────────────── */

function PageHeader({ schoolYear, onSchoolYear }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1c5fa8] text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 8.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.5L19 8.5z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13h7M8.5 16.5h5" />
          </svg>
        </span>
        <h1 className="text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100">
          Forms &amp; Renewals
        </h1>
      </div>
      <label className="sm:w-56">
        <span className="sr-only">School year</span>
        <select
          value={schoolYear}
          onChange={(e) => onSchoolYear(Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          {schoolYearOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function InfoNote() {
  return (
    <div className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-900/20">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="mt-0.5 h-5 w-5 shrink-0 text-[#1c5fa8] dark:text-sky-400"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM13.2 17h-2.4v-6h2.4v6z" />
      </svg>
      <div className="text-sm leading-6 text-gray-700 dark:text-gray-300">
        <p>
          Complete all required forms for each of your children. Forms with a status of{" "}
          <span className="font-bold">Action Required</span> need to be completed or renewed.
        </p>
        <p>Forms you have already sent stay here so you can review them at any time.</p>
      </div>
    </div>
  );
}

function Banner({ tone, children }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tones[tone] || tones.rose}`}>
      {children}
    </div>
  );
}

/* ─────────────────────────── child / family picker ─────────────────────────── */

function ScopePicker({ scopes, activeKey, rowsByScope, onSelect }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {scopes.map((scope) => {
          const rows = rowsByScope.get(scope.key) || [];
          const outstanding = rows.filter((row) => row.status === "ACTION_REQUIRED").length;
          const toStart = rows.filter((row) => row.status === "NOT_STARTED").length;
          const active = scope.key === activeKey;
          return (
            <button
              key={scope.key}
              type="button"
              data-scope-active={active ? "true" : "false"}
              onClick={() => onSelect(scope.key)}
              className={[
                "flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition",
                active
                  ? "border-[#1c5fa8] bg-sky-50 shadow-sm dark:border-sky-500 dark:bg-sky-900/30"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-700/40",
              ].join(" ")}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-white ${scope.tone}`}
              >
                {scope.kind === "FAMILY" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
                    <circle cx="9" cy="8" r="3" />
                    <circle cx="17" cy="9.5" r="2.2" />
                    <path strokeLinecap="round" d="M3.5 19a5.5 5.5 0 0 1 11 0" />
                    <path strokeLinecap="round" d="M16.4 14.6A4.4 4.4 0 0 1 20.5 19" />
                  </svg>
                ) : (
                  scope.initials
                )}
              </span>
              <span className="w-full truncate text-xs font-extrabold text-[#12386a] dark:text-gray-100">
                {scope.label}
              </span>
              {scope.sublabel ? (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{scope.sublabel}</span>
              ) : null}
              <span
                className={[
                  "text-[11px] font-extrabold",
                  outstanding
                    ? "text-rose-600 dark:text-rose-400"
                    : toStart || rows.length === 0
                      ? "text-gray-500 dark:text-gray-400"
                      : "text-emerald-600 dark:text-emerald-400",
                ].join(" ")}
              >
                {rows.length === 0
                  ? "No forms"
                  : outstanding
                    ? "Action Required"
                    : toStart
                      ? `${toStart} to start`
                      : "All complete"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── forms table ─────────────────────────── */

function FormsTable({ loading, scope, rows, totalRows, statusFilter, onStatusFilter, onOpen }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
          {scope ? `Forms for ${scope.label}` : "Forms"}
        </h2>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 sm:w-48"
        >
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map((key) => (
            <option key={key} value={key}>
              {STATUS_META[key].label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="px-5 pb-5">
          <Skeleton count={4} />
        </div>
      ) : rows.length === 0 ? (
        <div className="border-t border-gray-100 px-5 py-10 text-center dark:border-gray-700">
          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
            {totalRows === 0 ? "No forms assigned yet" : "No forms match this status"}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {totalRows === 0
              ? "The center has not assigned any paperwork to this selection."
              : "Choose a different status to see the rest of the list."}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50 text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                <th className="px-5 py-3">Form Name</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.template.id} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                  <td className="px-5 py-3">
                    <div className="font-bold text-gray-900 dark:text-gray-100">{row.template.title}</div>
                    {row.template.attachmentUrl ? (
                      <a
                        href={row.template.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-block text-xs font-bold text-[#1c5fa8] hover:underline dark:text-sky-400"
                      >
                        {row.template.attachmentName || "Attached document"}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatDate(row.dueDate)}</td>
                  <td className="px-5 py-3">
                    <FormStatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <RowAction row={row} onOpen={onOpen} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RowAction({ row, onOpen }) {
  const navy =
    "inline-flex items-center justify-center rounded-lg bg-[#12386a] px-5 py-1.5 text-xs font-extrabold text-white transition hover:bg-[#0b2545]";
  const light =
    "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-1.5 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700";

  if (row.action === "VIEW") {
    return (
      <button type="button" className={light} onClick={() => onOpen(row, "view")}>
        View
      </button>
    );
  }

  return (
    <button type="button" className={navy} onClick={() => onOpen(row, "fill")}>
      {row.action === "UPLOAD" ? "Upload" : row.action === "RENEW" ? "Renew" : "Start"}
    </button>
  );
}

function FormStatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.NOT_STARTED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${meta.pill}`}>
      <StatusIcon name={meta.icon} />
      {meta.label}
    </span>
  );
}

function StatusIcon({ name }) {
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.4-4-4 1.7-1.7 2.3 2.3 5.3-5.3 1.7 1.7-7 7z" />
      </svg>
    );
  }
  if (name === "alert") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.2 15h-2.4v-2.2h2.4V17zm0-3.8h-2.4V6.9h2.4v6.3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

/* ─────────────────────────── progress plans ─────────────────────────── */

function PendingPlans({ plans, approvingPlanId, onApprove }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/15">
      <h2 className="text-sm font-black text-amber-900 dark:text-amber-200">
        Individual Progress Plans — Approval Required
      </h2>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
        The center has created intervention plans for your child. Please review and approve them.
      </p>
      <div className="mt-3 space-y-3">
        {plans.map((plan) => {
          const childName = plan.child
            ? `${plan.child.firstName || ""} ${plan.child.lastName || ""}`.trim()
            : "";
          return (
            <div
              key={plan.id}
              className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{plan.title}</div>
                  {childName ? (
                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">For: {childName}</div>
                  ) : null}
                  <div className="mt-0.5 text-xs text-gray-500">
                    Plan Start: {formatDate(plan.startDate)}
                    {plan.createdBy?.name ? ` • Created by: ${plan.createdBy.name}` : ""}
                  </div>
                  {plan.description ? (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{plan.description}</p>
                  ) : null}
                  {[
                    ["Your Role (Parent Tactics)", plan.parentTactics],
                    ["Teacher Tactics", plan.teacherTactics],
                    ["Disciplinary Action", plan.disciplinaryAction],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="mt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
                        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{value}</p>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  disabled={approvingPlanId === plan.id}
                  onClick={() => onApprove(plan.id)}
                  className="inline-flex items-center justify-center rounded-lg bg-[#12386a] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#0b2545] disabled:opacity-60"
                >
                  {approvingPlanId === plan.id ? "Approving…" : "Approve Plan"}
                </button>
              </div>
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/25 dark:text-amber-200">
                By clicking &quot;Approve Plan&quot; you acknowledge and consent to this Individual Progress Plan
                for your child.
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────── submission history ─────────────────────────── */

function SubmissionHistory({ loading, submissions }) {
  const sorted = useMemo(
    () => [...submissions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [submissions],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="px-5 py-4">
        <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
          Submission timeline
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Everything your family has filed, newest first.
        </p>
      </div>

      {loading ? (
        <div className="px-5 pb-5">
          <Skeleton count={4} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          Nothing has been submitted yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
          {sorted.slice(0, 50).map((submission) => {
            const answers = summarizeSubmissionData(submission.data, 4);
            return (
              <div key={submission.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-gray-900 dark:text-gray-100">
                      {submission.template?.title || "Form"}
                    </div>
                    <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                      Submitted {formatDateTime(submission.createdAt)}
                      {" • "}
                      {submission.child
                        ? `${submission.child.firstName} ${submission.child.lastName || ""}`.trim()
                        : "Whole family"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      {submission.status}
                    </span>
                    {submission.expiresAt ? (
                      <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        {new Date(submission.expiresAt) < new Date()
                          ? "Expired"
                          : `Expires ${formatDate(submission.expiresAt)}`}
                      </span>
                    ) : null}
                  </div>
                </div>
                {answers.length ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {answers.map((item) => (
                      <div
                        key={`${submission.id}-${item.label}`}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-900/50"
                      >
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                          {item.label}
                        </div>
                        <div className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── form modal ─────────────────────────── */

function FormModal({ row, scope, mode, onClose, onSubmitted }) {
  const template = row.template;
  const fields = useMemo(() => normalizeTemplateFields(template.schema), [template.schema]);
  const [editing, setEditing] = useState(mode !== "view");
  const [values, setValues] = useState(() => buildInitialFormValues(fields, row.submission?.data || null));
  const [notes, setNotes] = useState(() => String(row.submission?.data?.notes || ""));
  const [attachment, setAttachment] = useState(() => row.submission?.data?.document || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const draft = useMemo(() => buildDraftState({ fields, values }), [fields, values]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setFormError("Files must be 25MB or smaller.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    setFormError("");
    try {
      const dataBase64 = await readFileAsBase64(file);
      const result = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
      });
      setAttachment({ url: result.url, name: file.name, size: file.size });
    } catch (e) {
      setFormError(e.message || "Could not upload that file.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (draft.errors.length) {
      setFormError(draft.errors[0]);
      return;
    }
    if (row.action === "UPLOAD" && !attachment) {
      setFormError("Attach the completed document before you send it.");
      return;
    }

    const data = { ...draft.data };
    if (notes.trim()) data.notes = notes.trim();
    if (attachment) data.document = attachment;

    setSaving(true);
    setFormError("");
    try {
      await apiJson("/api/v1/forms/submissions", {
        method: "POST",
        body: JSON.stringify({
          templateId: template.id,
          childId: scope?.child?.id || null,
          data: Object.keys(data).length ? data : null,
        }),
      });
      await onSubmitted(`${template.title} sent to the center.`);
    } catch (e) {
      setFormError(e.message || "Failed to submit this form");
    } finally {
      setSaving(false);
    }
  }

  const answers = summarizeSubmissionData(row.submission?.data, 24);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={template.title}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
              {template.title}
            </h2>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {describeAssignment(template)}
              {scope?.child ? ` • ${scope.label}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <FormStatusBadge status={row.status} />
            <span className="text-xs font-bold text-gray-500">Due {formatDate(row.dueDate)}</span>
            {template.requiresRenewal ? (
              <span className="text-xs font-bold text-gray-500">
                Renews every {template.renewalPeriodDays || "?"} days
              </span>
            ) : null}
          </div>

          {template.description ? (
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{template.description}</p>
          ) : null}

          {template.attachmentUrl ? (
            <a
              href={template.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold text-[#1c5fa8] transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-sky-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4" />
                <path strokeLinecap="round" d="M4 19h16" />
              </svg>
              Download {template.attachmentName || "the form"}
            </a>
          ) : null}

          {formError ? <Banner tone="rose">{formError}</Banner> : null}

          {!editing ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                Sent {formatDateTime(row.submission?.createdAt)}
              </div>
              {answers.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {answers.map((item) => (
                    <div
                      key={`answer-${item.label}`}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900/50"
                    >
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                        {item.label}
                      </div>
                      <div className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600">
                  No extra answers were included with this submission.
                </div>
              )}
              {row.submission?.data?.document?.url ? (
                <a
                  href={row.submission.data.document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm font-extrabold text-[#1c5fa8] hover:underline dark:text-sky-400"
                >
                  View the document you sent
                </a>
              ) : null}
            </>
          ) : (
            <form id="parent-form-modal" onSubmit={submit} className="space-y-4">
              {fields.length ? (
                <GuidedFormFields
                  fields={fields}
                  values={values}
                  onChange={(name, next) => setValues((current) => ({ ...current, [name]: next }))}
                />
              ) : null}

              <label className="block">
                <div className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500">
                  Notes for the center {fields.length ? "(optional)" : ""}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything the office should know about this form."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/50">
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500">
                  {row.action === "UPLOAD" ? "Completed document" : "Attach a document (optional)"}
                </div>
                {attachment ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-extrabold text-[#1c5fa8] hover:underline dark:text-sky-400"
                    >
                      {attachment.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-xs font-extrabold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">PDF, image, or document up to 25MB.</p>
                )}
                <input
                  type="file"
                  onChange={handleFile}
                  aria-label="Choose a document"
                  className="mt-2 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#12386a] file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-white dark:text-gray-300"
                />
                {uploading ? <p className="mt-2 text-xs font-bold text-gray-500">Uploading…</p> : null}
              </div>
            </form>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          >
            {editing ? "Cancel" : "Close"}
          </button>
          {editing ? (
            <button
              type="submit"
              form="parent-form-modal"
              disabled={saving || uploading}
              className="inline-flex items-center justify-center rounded-lg bg-[#12386a] px-5 py-2 text-sm font-extrabold text-white transition hover:bg-[#0b2545] disabled:opacity-60"
            >
              {saving ? "Sending…" : "Submit form"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center justify-center rounded-lg bg-[#12386a] px-5 py-2 text-sm font-extrabold text-white transition hover:bg-[#0b2545]"
            >
              Submit again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── row / scope helpers ─────────────────────────── */

const AVATAR_TONES = [
  "bg-[#2f80ed]",
  "bg-[#27ae60]",
  "bg-[#9b51e0]",
  "bg-[#f2994a]",
  "bg-[#12386a]",
  "bg-[#2d9cdb]",
  "bg-[#bb6bd9]",
  "bg-[#c0917a]",
];

function buildScopes(children) {
  const scopes = [
    { key: "family", kind: "FAMILY", label: "Family", sublabel: "", tone: "bg-[#4f6076]", child: null },
  ];
  children.forEach((child, index) => {
    const name = `${child.firstName || ""} ${child.lastName || ""}`.trim() || "Child";
    scopes.push({
      key: child.id,
      kind: "CHILD",
      label: name,
      sublabel: formatAgeMonths(ageInMonths(child.birthDate)) || "",
      initials: initialsOf(name),
      tone: AVATAR_TONES[index % AVATAR_TONES.length],
      child,
    });
  });
  return scopes;
}

/** Which of the center's forms this selection is responsible for. */
function templatesForScope(templates, scope) {
  return templates
    .filter((template) => {
      const type = normalizeAssignmentType(template.assignmentType);
      if (scope.kind === "FAMILY") return type === "FAMILY";
      if (type === "CHILD") return true;
      if (type === "AGE_GROUP") return childMatchesAgeGroup(template, scope.child);
      return false;
    })
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

function latestSubmission(submissions, templateId, childId) {
  return (
    submissions
      .filter(
        (item) => item.templateId === templateId && (childId ? item.childId === childId : !item.childId),
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

function buildRow(template, submission, now) {
  const dueDate = submission?.expiresAt || template.dueDate || null;
  const dueTime = dueDate ? new Date(dueDate).getTime() : null;
  const hasFields = normalizeTemplateFields(template.schema).length > 0;

  let status;
  if (!submission) {
    // A form the center renews, or one already past its due date, is the
    // paperwork a parent has to act on; everything else is simply not started.
    status =
      template.requiresRenewal || (dueTime !== null && dueTime < now) ? "ACTION_REQUIRED" : "NOT_STARTED";
  } else if (submission.status === "REJECTED") {
    status = "ACTION_REQUIRED";
  } else if (
    submission.expiresAt &&
    new Date(submission.expiresAt).getTime() <= now + RENEWAL_WINDOW_DAYS * DAY
  ) {
    status = "ACTION_REQUIRED";
  } else if (submission.status === "APPROVED") {
    status = "COMPLETED";
  } else {
    status = "SUBMITTED";
  }

  let action;
  if (status === "COMPLETED" || status === "SUBMITTED") action = "VIEW";
  else if (submission) action = "RENEW";
  else if (!hasFields && template.attachmentUrl) action = "UPLOAD";
  else action = "START";

  return { template, submission, status, action, dueDate };
}

/* ─────────────────────────── school year ─────────────────────────── */

function currentSchoolYearStart(now = new Date()) {
  // The academy's year runs August through July.
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

function schoolYearRange(startYear) {
  return {
    from: new Date(startYear, 7, 1).getTime(),
    to: new Date(startYear + 1, 7, 1).getTime(),
  };
}

function schoolYearOptions(now = new Date()) {
  const current = currentSchoolYearStart(now);
  const options = [];
  for (let offset = 1; offset >= -3; offset -= 1) {
    const year = current + offset;
    options.push({ value: year, label: `${year} - ${year + 1}` });
  }
  return options;
}

/* ─────────────────────────── misc helpers ─────────────────────────── */

function initialsOf(name) {
  const parts = String(name || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

/* ─────────────────────────── guided fields ─────────────────────────── */

function GuidedFormFields({ fields, values, onChange }) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <GuidedField key={field.name} field={field} value={values[field.name]} onChange={onChange} />
      ))}
    </div>
  );
}

function FieldShell({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
    </label>
  );
}

function GuidedField({ field, value, onChange }) {
  const commonClassName =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
  const optionClassName =
    "flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === "textarea") {
    return (
      <FieldShell label={label} hint={field.helpText}>
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={field.rows || 4}
          className={commonClassName}
          placeholder={field.placeholder || ""}
        />
      </FieldShell>
    );
  }

  if (field.type === "select") {
    return (
      <FieldShell label={label} hint={field.helpText}>
        <select
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={commonClassName}
        >
          <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
          {field.options.map((option) => (
            <option key={`${field.name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.type === "radio") {
    return (
      <FieldShell label={label} hint={field.helpText}>
        <div className="grid gap-2">
          {field.options.map((option) => (
            <label key={`${field.name}-${option.value}`} className={optionClassName}>
              <input
                type="radio"
                name={field.name}
                value={option.value}
                checked={String(value || "") === option.value}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </FieldShell>
    );
  }

  if (field.type === "checkbox") {
    return (
      <FieldShell label={label} hint={field.helpText}>
        <label className={optionClassName}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>{field.placeholder || "Check to confirm"}</span>
        </label>
      </FieldShell>
    );
  }

  if (field.type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <FieldShell label={label} hint={field.helpText}>
        <div className="grid gap-2">
          {field.options.map((option) => (
            <label key={`${field.name}-${option.value}`} className={optionClassName}>
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(e) =>
                  onChange(
                    field.name,
                    e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((entry) => entry !== option.value),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </FieldShell>
    );
  }

  if (field.type === "json") {
    return (
      <FieldShell label={label} hint={field.helpText || "JSON object or array"}>
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={field.rows || 5}
          className={`${commonClassName} font-mono`}
          placeholder={field.placeholder || "{}"}
        />
      </FieldShell>
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "email"
          ? "email"
          : "text";

  return (
    <FieldShell label={label} hint={field.helpText}>
      <input
        type={inputType}
        value={value ?? ""}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={commonClassName}
        placeholder={field.placeholder || ""}
        step={field.type === "number" ? "any" : undefined}
      />
    </FieldShell>
  );
}

/* ─────────────────────────── template schema ─────────────────────────── */

function normalizeTemplateFields(schema) {
  if (!schema || typeof schema !== "object") return [];

  const sourceFields = Array.isArray(schema)
    ? schema
    : Array.isArray(schema.fields)
      ? schema.fields
      : schema.properties && typeof schema.properties === "object"
        ? Object.entries(schema.properties).map(([name, config]) => ({
            ...(config && typeof config === "object" && !Array.isArray(config) ? config : {}),
            name,
          }))
        : [];

  return sourceFields.map((field, index) => normalizeTemplateField(field, index)).filter(Boolean);
}

function normalizeTemplateField(field, index) {
  if (!field || typeof field !== "object" || Array.isArray(field)) return null;

  const rawName = field.name || field.key || field.id || `field_${index + 1}`;
  const name = String(rawName || "").trim();
  if (!name) return null;

  const type = normalizeFieldType(field.type || field.input || field.component);

  return {
    name,
    label: String(field.label || field.title || humanizeKey(name)),
    type,
    required: Boolean(field.required),
    placeholder: String(field.placeholder || ""),
    helpText: String(field.helpText || field.description || ""),
    rows: Number(field.rows) > 0 ? Number(field.rows) : undefined,
    options: normalizeFieldOptions(field.options || field.enum || field.choices),
    defaultValue:
      field.defaultValue !== undefined
        ? field.defaultValue
        : field.default !== undefined
          ? field.default
          : defaultValueForFieldType(type),
  };
}

function normalizeFieldType(type) {
  const value = String(type || "text").trim().toLowerCase();
  if (["textarea", "multiline", "longtext"].includes(value)) return "textarea";
  if (["number", "integer", "float", "decimal"].includes(value)) return "number";
  if (["date", "datetime", "datetime-local"].includes(value)) return "date";
  if (value === "email") return "email";
  if (["select", "dropdown"].includes(value)) return "select";
  if (value === "radio") return "radio";
  if (["checkbox", "boolean", "toggle"].includes(value)) return "checkbox";
  if (["multiselect", "array", "checkbox-group"].includes(value)) return "multiselect";
  if (["json", "object"].includes(value)) return "json";
  return "text";
}

function normalizeFieldOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (option && typeof option === "object" && !Array.isArray(option)) {
        const value = String(option.value ?? option.id ?? option.label ?? "").trim();
        if (!value) return null;
        return { value, label: String(option.label ?? option.name ?? option.value ?? value) };
      }
      const value = String(option || "").trim();
      if (!value) return null;
      return { value, label: value };
    })
    .filter(Boolean);
}

function buildInitialFormValues(fields, sourceData = null) {
  const source =
    sourceData && typeof sourceData === "object" && !Array.isArray(sourceData) ? sourceData : {};

  return fields.reduce((acc, field) => {
    const rawValue = source[field.name] !== undefined ? source[field.name] : field.defaultValue;
    acc[field.name] = normalizeFieldValue(field, rawValue);
    return acc;
  }, {});
}

function normalizeFieldValue(field, rawValue) {
  if (field.type === "checkbox") return Boolean(rawValue);
  if (field.type === "multiselect") return Array.isArray(rawValue) ? rawValue.map(String) : [];
  if (field.type === "json") {
    if (rawValue === undefined || rawValue === null || rawValue === "") return "";
    return formatJsonText(rawValue);
  }
  if (field.type === "number") return rawValue ?? "";
  return rawValue == null ? "" : String(rawValue);
}

function defaultValueForFieldType(type) {
  if (type === "checkbox") return false;
  if (type === "multiselect") return [];
  return "";
}

function buildDraftState({ fields, values }) {
  const data = {};
  const errors = [];

  for (const field of fields) {
    const rawValue = values[field.name];

    if (field.type === "checkbox") {
      if (field.required && !rawValue) {
        errors.push(`${field.label} must be checked before you can submit.`);
        continue;
      }
      data[field.name] = Boolean(rawValue);
      continue;
    }

    if (field.type === "multiselect") {
      const normalized = Array.isArray(rawValue)
        ? rawValue.map((entry) => String(entry).trim()).filter(Boolean)
        : [];
      if (field.required && normalized.length === 0) {
        errors.push(`${field.label} is required.`);
        continue;
      }
      if (normalized.length > 0) data[field.name] = normalized;
      continue;
    }

    if (field.type === "number") {
      const textValue = String(rawValue ?? "").trim();
      if (!textValue) {
        if (field.required) errors.push(`${field.label} is required.`);
        continue;
      }
      const numeric = Number(textValue);
      if (!Number.isFinite(numeric)) {
        errors.push(`${field.label} must be a valid number.`);
        continue;
      }
      data[field.name] = numeric;
      continue;
    }

    if (field.type === "json") {
      const textValue = String(rawValue ?? "").trim();
      if (!textValue) {
        if (field.required) errors.push(`${field.label} is required.`);
        continue;
      }
      try {
        data[field.name] = JSON.parse(textValue);
      } catch {
        errors.push(`${field.label} must contain valid JSON.`);
      }
      continue;
    }

    const textValue = String(rawValue ?? "").trim();
    if (!textValue) {
      if (field.required) errors.push(`${field.label} is required.`);
      continue;
    }
    data[field.name] = textValue;
  }

  return { data, errors };
}

function summarizeSubmissionData(data, limit = 4) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return [{ label: "Entries", value: `${data.length} item${data.length === 1 ? "" : "s"}` }];
  }
  if (typeof data !== "object") {
    return [{ label: "Value", value: formatPreviewValue(data) }];
  }
  return Object.entries(data)
    .filter(([key]) => key !== "document")
    .slice(0, limit)
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatPreviewValue(value) }));
}

function formatPreviewValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map((entry) => formatPreviewValue(entry)).join(", ") : "None";
  }
  if (value && typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 117)}...` : json;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatJsonText(data) {
  if (data == null || data === "") return "";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "";
  }
}
