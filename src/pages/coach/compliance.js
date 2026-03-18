import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachChipButton,
  CoachEmptyPanel,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
  coachSecondaryButtonClass,
} from "@/components/coach/CoachPage";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";

const ALL_CENTERS = "__ALL__";

export default function CoachCompliance() {
  const router = useRouter();
  const { data: session } = useSession();
  const { centerId: qCenterId } = router.query;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);

        if (qCenterId) {
          setCenterId(String(qCenterId));
        } else if (nextCenters.length === 1) {
          setCenterId(nextCenters[0].id);
        } else if (session?.user?.role === "ADMIN") {
          setCenterId(ALL_CENTERS);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err.message || "Failed to load centers");
        setLoading(false);
      }
    })();
  }, [qCenterId, session?.user?.role]);

  useEffect(() => {
    if (!centerId && !isAdmin) return;
    if (!centerId && isAdmin) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const url =
          centerId === ALL_CENTERS
            ? "/api/v1/compliance/summary"
            : `/api/v1/compliance/summary?centerId=${encodeURIComponent(centerId)}`;
        const response = await apiJson(url);
        setData(response);
      } catch (err) {
        setError(err.message || "Failed to load compliance summary");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, isAdmin]);

  const teachers = (data?.teachers || [])
    .slice()
    .sort((left, right) => {
      const leftAttention = (left.logs?.last24Hours || 0) === 0 ? 1 : 0;
      const rightAttention = (right.logs?.last24Hours || 0) === 0 ? 1 : 0;
      if (leftAttention !== rightAttention) return rightAttention - leftAttention;
      return (left.logs?.last7Days || 0) - (right.logs?.last7Days || 0);
    })
    .filter((teacher) => {
      if (attentionOnly && (teacher.logs?.last24Hours || 0) > 0) return false;
      if (!search.trim()) return true;
      const haystack = `${teacher.name || ""} ${teacher.email || ""}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });

  const compliantCount = (data?.teachers || []).filter((teacher) => (teacher.logs?.last24Hours || 0) > 0).length;
  const needsFollowUpCount = (data?.teachers || []).filter((teacher) => (teacher.logs?.last24Hours || 0) === 0).length;
  const totalLast24 = (data?.teachers || []).reduce(
    (sum, teacher) => sum + Number(teacher.logs?.last24Hours || 0),
    0,
  );
  const totalLast7 = (data?.teachers || []).reduce(
    (sum, teacher) => sum + Number(teacher.logs?.last7Days || 0),
    0,
  );

  const activeCenterName =
    centerId === ALL_CENTERS
      ? "All centers"
      : centers.find((center) => center.id === centerId)?.name || "";

  return (
    <CoachLayout title="Compliance">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Compliance Watch"
          title="Spot logging gaps before they become coaching problems."
          description="Review who has recent activity, who needs a check-in, and where accountability should be reinforced today."
          meta={
            <>
              {activeCenterName ? <CoachBadge tone="sky">{activeCenterName}</CoachBadge> : null}
              {data?.since ? (
                <CoachBadge tone="slate">
                  7-day view since {new Date(data.since).toLocaleDateString("en-US")}
                </CoachBadge>
              ) : null}
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
                >
                  {!isAdmin ? <option value="">Select a center...</option> : null}
                  {isAdmin ? <option value={ALL_CENTERS}>All centers</option> : null}
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Search Teacher
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={coachInputClass}
                  placeholder="Name or email"
                  disabled={!centerId}
                />
              </label>
            </div>
          }
          actions={
            centerId ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setAttentionOnly((current) => !current)}
                  className={coachSecondaryButtonClass}
                >
                  {attentionOnly ? "Show All Teachers" : "Show Needs Follow-up"}
                </button>
                <Link href={`/coach/follow-ups${centerId === ALL_CENTERS ? "" : `?centerId=${centerId}`}`} className={coachSecondaryButtonClass}>
                  Open Follow-ups
                </Link>
              </div>
            ) : null
          }
          stats={
            centerId ? (
              <>
                <CoachMetricCard
                  label="Teachers"
                  value={String(data?.teachers?.length || 0)}
                  hint="People in this review"
                  tone="sky"
                  icon={<TeamIcon />}
                />
                <CoachMetricCard
                  label="Compliant Today"
                  value={String(compliantCount)}
                  hint="Logged in the last 24 hours"
                  tone="emerald"
                  icon={<CheckIcon />}
                />
                <CoachMetricCard
                  label="Needs Follow-up"
                  value={String(needsFollowUpCount)}
                  hint="No logs in the last 24 hours"
                  tone={needsFollowUpCount ? "rose" : "emerald"}
                  icon={<AlertIcon />}
                />
                <CoachMetricCard
                  label="Total Logs"
                  value={`${totalLast24}/${totalLast7}`}
                  hint="24 hours / 7 days"
                  tone="amber"
                  icon={<BarsIcon />}
                />
              </>
            ) : null
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!centerId ? (
          <CoachEmptyPanel
            title="Select a center to review compliance."
            description="Coaches need a center-scoped compliance view so logging expectations stay tied to the correct team."
          />
        ) : null}

        {centerId ? (
          <CoachPanel
            title="Teacher Logging Status"
            description="Teachers with no logs in the last 24 hours are surfaced first so follow-up starts with the highest-risk gaps."
          >
            {loading ? (
              <SkeletonTable rows={6} cols={4} />
            ) : teachers.length === 0 ? (
              <CoachEmptyPanel
                title="No teachers match the current view."
                description="Try clearing the search or turning off the attention-only filter."
                icon={<TeamIcon />}
              />
            ) : (
              <div className="space-y-3">
                {teachers.map((teacher) => {
                  const last24 = Number(teacher.logs?.last24Hours || 0);
                  const last7 = Number(teacher.logs?.last7Days || 0);
                  const compliant = last24 > 0;
                  const ratio = Math.min(100, Math.round((last7 / 20) * 100));

                  return (
                    <div
                      key={teacher.id}
                      className={`rounded-[1.6rem] border p-5 shadow-sm ${
                        compliant
                          ? "border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-slate-900/80"
                          : "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-black text-gray-900 dark:text-gray-100">
                              {teacher.name || teacher.email}
                            </div>
                            <CoachBadge tone={compliant ? "emerald" : "rose"}>
                              {compliant ? "On track" : "Needs follow-up"}
                            </CoachBadge>
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {teacher.email}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!compliant ? (
                            <Link
                              href={`/coach/follow-ups?assignedToId=${teacher.id}${centerId === ALL_CENTERS ? "" : `&centerId=${centerId}`}`}
                              className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                            >
                              Create Follow-up
                            </Link>
                          ) : null}
                          <Link
                            href={`/coach/observations?teacherId=${teacher.id}${centerId === ALL_CENTERS ? "" : `&centerId=${centerId}`}`}
                            className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
                          >
                            Observe
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <MetricPill label="Last 24 hours" value={String(last24)} tone={compliant ? "emerald" : "rose"} />
                        <MetricPill label="Last 7 days" value={String(last7)} tone="sky" />
                        <MetricPill label="Weekly rhythm" value={ratio >= 75 ? "Strong" : ratio >= 35 ? "Watch" : "Light"} tone={ratio >= 75 ? "emerald" : ratio >= 35 ? "amber" : "rose"} />
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                          7-day activity intensity
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              compliant ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.max(ratio, 6)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CoachPanel>
        ) : null}
      </div>
    </CoachLayout>
  );
}

function MetricPill({ label, value, tone }) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
    sky: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
  };

  return (
    <div className={`rounded-[1.35rem] border px-4 py-3 ${toneClasses[tone] || toneClasses.sky}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 00-12 0M14.25 9.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM20.25 14.25a2.25 2.25 0 10-4.5 0M8.25 14.25a2.25 2.25 0 10-4.5 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm8.25-4.86c0 5.027-3.94 9.11-8.85 9.11S2.55 16.667 2.55 11.64 6.49 2.53 11.4 2.53s8.85 4.083 8.85 9.11z" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 18V9.75m5.25 8.25v-12m5.25 12v-6" />
    </svg>
  );
}
