import { useSession } from "next-auth/react";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { buildParentMessageComposeHref } from "@/lib/parentSupport";
import AppShell from "@/components/shell/AppShell";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import { STAFF_NAV_ITEMS } from "@/components/staff/staffNav";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";
import {
  ParentButton,
  ParentPageHeader,
  ParentSection,
} from "@/components/parent/ParentUI";

const NAV_BASE = [{ href: "/dashboard", label: "Dashboard" }];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = session?.user?.role;
  const name = session?.user?.name || session?.user?.email || "Welcome";

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [activities, setActivities] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.role === "ADMIN") {
      router.replace("/admin/dashboard");
    }
    if (session?.user?.role === "TEACHER") {
      router.replace("/teacher/dashboard");
    }
    if (session?.user?.role === "OTHER_STAFF") {
      router.replace("/staff/dashboard");
    }
    if (session?.user?.role === "COACH") {
      router.replace("/coach/dashboard");
    }
  }, [status, session?.user?.role, router]);

  const nav = useMemo(() => {
    if (role === "ADMIN") return ADMIN_NAV_ITEMS;
    if (role === "TEACHER") return TEACHER_NAV_ITEMS;
    if (role === "OTHER_STAFF") return STAFF_NAV_ITEMS;
    if (role === "COACH") return COACH_NAV_ITEMS;
    if (role === "SUBSCRIBER") return SUBSCRIBER_NAV_ITEMS;
    if (role === "PARENT") return PARENT_NAV_ITEMS;
    return NAV_BASE;
  }, [role]);

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (role === "PARENT") {
          const [c, kids, formSubmissions] = await Promise.all([
            apiJson("/api/v1/centers"),
            apiJson("/api/v1/children"),
            apiJson("/api/v1/forms/submissions"),
          ]);
          const centersArr = Array.isArray(c) ? c : [];
          const kidsArr = Array.isArray(kids) ? kids : [];
          setCenters(centersArr);
          setChildren(kidsArr);
          setChildId(kidsArr[0]?.id || "");
          setSubmissions(Array.isArray(formSubmissions) ? formSubmissions : []);
        } else {
          const c = await apiJson("/api/v1/centers");
          const centersArr = Array.isArray(c) ? c : [];
          setCenters(centersArr);
          const defaultCenterId =
            typeof router.query.centerId === "string"
              ? router.query.centerId
              : centersArr.length === 1
                ? centersArr[0].id
                : "";
          setCenterId(defaultCenterId);
        }
      } catch (e) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, role, router.query.centerId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (role === "PARENT") return;
    if (!centerId) {
      setChildren([]);
      setChildId("");
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson(
          `/api/v1/children?centerId=${encodeURIComponent(centerId)}`,
        );
        const kidsArr = Array.isArray(kids) ? kids : [];
        setChildren(kidsArr);
        const selected =
          typeof router.query.childId === "string"
            ? router.query.childId
            : kidsArr[0]?.id || "";
        setChildId(selected);
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, role, centerId, router.query.childId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!childId) {
      setActivities([]);
      return;
    }

    (async () => {
      try {
        const list = await apiJson(
          `/api/v1/activities?childId=${encodeURIComponent(childId)}`,
        );
        setActivities(Array.isArray(list) ? list.slice(0, 6) : []);
      } catch {
        setActivities([]);
      }
    })();
  }, [status, childId]);

  const selectedChild = useMemo(() => {
    return children.find((c) => c.id === childId) || null;
  }, [children, childId]);

  const subscriptionSummary = useMemo(() => {
    const c = centers[0];
    if (!c?.subscription) return null;
    return {
      centerName: c.name,
      tier: c.subscription.tier || "—",
      active: !!c.subscription.active,
      expiresAt: c.subscription.expiresAt ? new Date(c.subscription.expiresAt) : null,
    };
  }, [centers]);

  if (status === "loading")
    return <div className="p-6"><Skeleton count={5} /></div>;
  if (!session)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title="Dashboard"
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      navItems={nav}
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
      showBack={false}
    >
      {role === "PARENT" ? (
        <ParentDashboard
          name={name}
          children={children}
          selectedChild={selectedChild}
          loading={loading}
          error={error}
          activities={activities}
          submissions={submissions}
          subscriptionSummary={subscriptionSummary}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-5">
              <div className="overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-sky-50 via-white to-amber-50/80 p-6 shadow-[0_24px_70px_-48px_rgba(14,116,144,0.65)]">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-700">
                      Workspace overview
                    </div>
                    <h2 className="mt-3 truncate text-3xl font-black tracking-tight text-gray-900">
                      {name}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                      {role === "PARENT"
                        ? "Your children are ready for a great day."
                        : role === "TEACHER"
                          ? "Focus on classroom logging, lessons, and the children currently assigned to your center."
                          : role === "ADMIN"
                            ? "Manage classrooms, students, and staff — with full control."
                            : "Welcome."}
                    </p>
                  </div>

                  {(role === "ADMIN" || role === "TEACHER") && centers.length ? (
                    <div className="w-full max-w-xs rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm">
                      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">
                        Active center
                      </div>
                      <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Select a center…</option>
                        {centers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <DashboardStatCard
                    label="Centers"
                    value={centers.length}
                    hint={centerId ? "One center currently in focus" : "Choose a center to filter"}
                    tone="sky"
                  />
                  <DashboardStatCard
                    label="Children"
                    value={loading ? "..." : children.length}
                    hint={centerId ? "Available in this workspace view" : "Awaiting center selection"}
                    tone="emerald"
                  />
                  <DashboardStatCard
                    label="Recent activity"
                    value={activities.length}
                    hint={childId ? "Loaded for the selected child" : "Pick a child to inspect updates"}
                    tone="amber"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-200 bg-white/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-gray-900">
                      Children
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {role === "PARENT"
                        ? "Quick access to your child profiles and recent activity."
                        : role === "TEACHER"
                          ? "Limited to your assigned centers/classrooms."
                          : "Select a center to view children."}
                    </p>
                  </div>
                  {role === "ADMIN" ? (
                    <Link
                      href="/admin/children"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Manage Students
                    </Link>
                  ) : role === "TEACHER" ? (
                    <Link
                      href="/teacher/children"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </Link>
                  ) : null}
                </div>

                {error ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                ) : null}

                {loading ? (
                  <div className="mt-4"><Skeleton count={4} /></div>
                ) : role !== "PARENT" && !centerId ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    Select a center to load children.
                  </div>
                ) : children.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    No children found.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {children.slice(0, 8).map((ch) => {
                      const active = ch.id === childId;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setChildId(ch.id)}
                          className={[
                            "rounded-[24px] border p-4 text-left transition-all duration-200",
                            active
                              ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm"
                              : "border-gray-200 bg-white hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-extrabold text-gray-700">
                              {initials(ch.firstName, ch.lastName)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-gray-900">
                                {ch.firstName} {ch.lastName || ""}
                              </div>
                              <div className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                {ch.classRoomId ? `Class: ${ch.classRoomId}` : "Class: —"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-gray-200 bg-white/85 p-5 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900">
                  Quick access
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Shortcuts for the most common next actions in this workspace.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <QuickTile
                    title="Policies & Handbook"
                    subtitle="Procedures & guidelines"
                    href={
                      role === "PARENT"
                        ? "/parent/policies"
                        : role === "COACH"
                          ? "/coach/policies"
                          : "/teacher/policies"
                    }
                  />
                  <QuickTile
                    title="Lesson Plans"
                    subtitle="Training media & materials"
                    href={
                      role === "TEACHER"
                        ? "/teacher/lessons"
                        : role === "ADMIN"
                          ? "/admin/lessons"
                          : "/teacher/lessons"
                    }
                    disabled={role === "PARENT"}
                  />
                  <QuickTile
                    title="Checklists"
                    subtitle="Daily/weekly tasks"
                    href={
                      role === "ADMIN"
                        ? "/admin/checklists"
                        : role === "COACH"
                          ? "/coach/checklists"
                          : "/teacher/checklists"
                    }
                    disabled={role === "PARENT" || role === "SUBSCRIBER"}
                  />
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-[28px] border border-gray-200 bg-white/85 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-gray-900">
                    Recent Activity
                  </h3>
                  {selectedChild ? (
                    <span className="text-xs font-semibold text-gray-500">
                      {selectedChild.firstName}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {childId && activities.length ? (
                    activities.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {a.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(a.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          {a.notes || "—"}
                        </div>
                        {a.isBackdated ? (
                          <div className="mt-2 text-xs font-semibold text-amber-700">
                            Backdated
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-4 text-sm text-gray-600">
                      Select a child to view recent activity.
                    </div>
                  )}
                </div>

                {role === "TEACHER" && childId ? (
                  <Link
                    href={`/teacher/logs?centerId=${encodeURIComponent(centerId || "")}&childId=${encodeURIComponent(childId)}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700"
                  >
                    Log Activity
                  </Link>
                ) : role === "ADMIN" && childId ? (
                  <Link
                    href={`/admin/activity-overrides?centerId=${encodeURIComponent(centerId || "")}&childId=${encodeURIComponent(childId)}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700"
                  >
                    Override Activity
                  </Link>
                ) : null}
              </div>

              {role === "PARENT" ? (
                <div className="rounded-[28px] border border-gray-200 bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-gray-900">
                      Billing
                    </h3>
                    {subscriptionSummary ? (
                      <span className="text-xs font-semibold text-gray-500">
                        {subscriptionSummary.tier}
                      </span>
                    ) : null}
                  </div>
                  {subscriptionSummary ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                      <div className="font-semibold text-gray-900">
                        {subscriptionSummary.centerName}
                      </div>
                      <div className="mt-1">
                        Status:{" "}
                        <span className="font-semibold">
                          {subscriptionSummary.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-1">
                        Expires:{" "}
                        <span className="font-semibold">
                          {subscriptionSummary.expiresAt
                            ? subscriptionSummary.expiresAt.toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                      <Link
                        href={buildParentMessageComposeHref({
                          subject: `Billing support for ${subscriptionSummary.centerName}`,
                          message: `Hello, I need help with billing for ${subscriptionSummary.centerName}. Please share the next steps or a payment link when available.`,
                        })}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
                      >
                        Request payment link
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      Billing details not available yet.
                    </div>
                  )}
                </div>
              ) : null}

              {role === "ADMIN" ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h3 className="text-base font-extrabold text-gray-900">
                    Admin Shortcuts
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Shortcut href="/admin/users" label="RBAC" />
                    <Shortcut href="/admin/teachers" label="Staff" />
                    <Shortcut href="/admin/children" label="Students" />
                    <Shortcut href="/admin/classes" label="Classrooms" />
                    <Shortcut href="/admin/lessons" label="Lessons" />
                    <Shortcut href="/admin/subscriptions" label="Subscriptions" />
                  </div>
                </div>
              ) : null}
        </aside>
      </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        User ID: <span className="font-mono">{session?.user?.id}</span>
      </div>
    </AppShell>
  );
}

const GWA_DOMAIN_LABELS = {
  cognitive: "Cognitive",
  social: "Social-Emotional",
  physical: "Physical",
  language: "Language",
  creative: "Creative",
};

const GWA_DOMAIN_COLORS = {
  cognitive: "bg-sky-400",
  social: "bg-emerald-400",
  physical: "bg-amber-400",
  language: "bg-blue-400",
  creative: "bg-blue-400",
};

function inferProgressDomain(row) {
  const categoryName = String(row?.lesson?.category?.name || "").toLowerCase();
  const lessonTitle = String(row?.lesson?.title || "").toLowerCase();
  const text = `${categoryName} ${lessonTitle}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior"))
    return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement"))
    return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics"))
    return "Language & Literacy";
  if (text.includes("creative") || text.includes("art") || text.includes("music"))
    return "Creative";
  return "Cognitive";
}

const GWA_PROGRESS_DOMAIN_CONFIG = [
  { name: "Cognitive", color: "bg-sky-400" },
  { name: "Social-Emotional", color: "bg-emerald-400" },
  { name: "Physical", color: "bg-amber-400" },
  { name: "Language & Literacy", color: "bg-blue-400" },
  { name: "Creative", color: "bg-blue-400" },
];

const AGE_GROUPS = [
  { key: "0-1", label: "0-1 year", min: 0, max: 11 },
  { key: "2", label: "2 years", min: 12, max: 23 },
  { key: "3", label: "3 years", min: 24, max: 35 },
  { key: "4-5", label: "4-5 years", min: 36, max: 59 },
  { key: "6-7", label: "6-7 years", min: 60, max: 83 },
  { key: "8-12", label: "8-12 years", min: 84, max: 143 },
];

function ageInMonths(birthDate) {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months;
}

function getAgeGroup(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return null;
  return AGE_GROUPS.find((g) => months >= g.min && months <= g.max) || null;
}

function formatAge(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return "";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}y`;
  return `${years}y ${rem}mo`;
}

function assessProgression(birthDate, progressStats) {
  if (!progressStats || progressStats.total === 0) return null;
  const { completionRate } = progressStats;
  const months = ageInMonths(birthDate);

  // Younger children (0-2) have more lenient expectations
  // Older children should show higher completion rates
  let expectedRate = 40; // default baseline
  if (months !== null) {
    if (months <= 23) expectedRate = 25;      // 0-1 year
    else if (months <= 35) expectedRate = 35;  // 2 years
    else if (months <= 59) expectedRate = 45;  // 4-5 years
    else expectedRate = 55;                    // 6+ years
  }

  if (completionRate >= expectedRate + 20) {
    return { status: "ahead", label: "Ahead", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  }
  if (completionRate >= expectedRate - 10) {
    return { status: "on-track", label: "On Track", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
  }
  return { status: "behind", label: "Behind", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
}

function computeChildGWA(activities, progressRows) {
  const overallGrades = [];
  const domainSums = {};
  const domainCounts = {};

  for (const a of activities) {
    const details =
      a?.details && typeof a.details === "object" && !Array.isArray(a.details)
        ? a.details
        : {};
    if (details.kind !== "DAILY_GRADE") continue;

    if (details.domains && typeof details.domains === "object") {
      for (const [key, val] of Object.entries(details.domains)) {
        if (!Number.isFinite(val)) continue;
        domainSums[key] = (domainSums[key] || 0) + val;
        domainCounts[key] = (domainCounts[key] || 0) + 1;
      }
    }

    if (details.domainAvg != null && Number.isFinite(Number(details.domainAvg))) {
      overallGrades.push((Number(details.domainAvg) / 4) * 100);
    } else if (Number.isFinite(Number(details.grade))) {
      overallGrades.push((Number(details.grade) / 10) * 100);
    }
  }

  // Compute progression stats from progress records (always, for the summary)
  const rows = Array.isArray(progressRows) ? progressRows : [];
  const totalSteps = rows.length;
  const completedSteps = rows.filter((r) => {
    const s = String(r?.status || "");
    return s === "COMPLETED" || s === "PASSED";
  }).length;
  const inProgressSteps = rows.filter((r) => String(r?.status || "") === "IN_PROGRESS").length;
  const progressStats = {
    total: totalSteps,
    completed: completedSteps,
    inProgress: inProgressSteps,
    completionRate: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
  };

  // If we have daily grade data, use that
  if (overallGrades.length) {
    const domains = Object.keys(domainSums).map((key) => ({
      key,
      label: GWA_DOMAIN_LABELS[key] || key,
      avg: Math.round((domainSums[key] / domainCounts[key]) * 10) / 10,
      maxScale: 4,
      color: GWA_DOMAIN_COLORS[key] || "bg-gray-400",
    }));

    return {
      overall: Math.round(overallGrades.reduce((s, v) => s + v, 0) / overallGrades.length),
      domains,
      source: "grades",
      progressStats,
    };
  }

  // Fallback: compute from progress records
  if (!rows.length) return null;

  const byDomain = {};
  for (const cfg of GWA_PROGRESS_DOMAIN_CONFIG) {
    byDomain[cfg.name] = { total: 0, complete: 0, color: cfg.color };
  }

  for (const row of rows) {
    const domain = inferProgressDomain(row);
    if (!byDomain[domain]) continue;
    byDomain[domain].total += 1;
    const s = String(row?.status || "");
    if (s === "COMPLETED" || s === "PASSED") byDomain[domain].complete += 1;
  }

  const domains = GWA_PROGRESS_DOMAIN_CONFIG
    .filter((cfg) => byDomain[cfg.name].total > 0)
    .map((cfg) => {
      const stat = byDomain[cfg.name];
      const pct = Math.round((stat.complete / stat.total) * 100);
      return {
        key: cfg.name,
        label: cfg.name,
        avg: pct,
        maxScale: 100,
        color: cfg.color,
      };
    });

  return {
    overall: progressStats.completionRate,
    domains,
    source: "progress",
    progressStats,
  };
}

function formatDashboardTimestamp(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DashboardIcon({ tone = "sky", children, className = "" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-slate-900/90 dark:text-slate-300",
  };

  return (
    <div
      className={[
        "flex h-11 w-11 items-center justify-center rounded-2xl",
        tones[tone] || tones.sky,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function ParentDashboardPanel({
  eyebrow,
  title,
  description,
  accent = "sky",
  children,
  className = "",
}) {
  const accents = {
    sky: {
      line: "from-sky-500 via-cyan-500 to-blue-500",
      pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/50 dark:text-sky-300",
      bloom: "bg-sky-100/80 dark:bg-sky-500/10",
    },
    emerald: {
      line: "from-emerald-500 via-teal-500 to-cyan-500",
      pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-300",
      bloom: "bg-emerald-100/80 dark:bg-emerald-500/10",
    },
    amber: {
      line: "from-amber-500 via-orange-500 to-rose-500",
      pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-300",
      bloom: "bg-amber-100/80 dark:bg-amber-500/10",
    },
    rose: {
      line: "from-rose-500 via-pink-500 to-orange-500",
      pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/45 dark:text-rose-300",
      bloom: "bg-rose-100/80 dark:bg-rose-500/10",
    },
  };
  const accentClasses = accents[accent] || accents.sky;

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_22px_60px_-42px_rgba(2,6,23,0.95)]",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          accentClasses.line,
        ].join(" ")}
      />
      <div
        className={[
          "pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full blur-3xl",
          accentClasses.bloom,
        ].join(" ")}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow ? (
              <div
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]",
                  accentClasses.pill,
                ].join(" ")}
              >
                {eyebrow}
              </div>
            ) : null}
            <h3 className="mt-2.5 text-base font-black tracking-tight text-gray-900 dark:text-slate-100">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function ParentApprovalAlert({ plans }) {
  const count = plans.length;
  const firstChildName = (() => {
    const child = plans[0]?.child;
    return child ? `${child.firstName || ""} ${child.lastName || ""}`.trim() : "";
  })();

  return (
    <div className="w-full rounded-[24px] border border-amber-300 bg-amber-50 p-4 shadow-[0_18px_45px_-30px_rgba(217,119,6,0.4)] dark:border-amber-500/40 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-amber-900 dark:text-amber-100">
              {count === 1
                ? `An Individual Progress Plan for ${firstChildName || "your child"} needs your approval`
                : `${count} Individual Progress Plans need your approval`}
            </div>
            <p className="mt-1 text-[13px] leading-5 text-amber-800/90 dark:text-amber-200/80">
              Review the plan details and record your approval decision.
            </p>
          </div>
        </div>
        <ParentButton href="/parent/children?tab=progress_plan" className="shrink-0 px-3 py-2 text-xs">
          Review now
        </ParentButton>
      </div>
    </div>
  );
}

function ParentDashboardActionCard({
  href,
  eyebrow,
  title,
  description,
  meta,
  tone = "sky",
  icon,
  className = "",
}) {
  const tones = {
    sky: {
      card: "border-sky-100 bg-white hover:border-sky-200 hover:bg-sky-50/70 dark:border-sky-500/15 dark:bg-slate-950/80 dark:hover:border-sky-500/30 dark:hover:bg-sky-950/25",
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
      meta: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/45 dark:text-sky-300",
      glow: "bg-sky-100/70 dark:bg-sky-500/10",
    },
    emerald: {
      card: "border-emerald-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/70 dark:border-emerald-500/15 dark:bg-slate-950/80 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-950/25",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
      meta: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-300",
      glow: "bg-emerald-100/70 dark:bg-emerald-500/10",
    },
    amber: {
      card: "border-amber-100 bg-white hover:border-amber-200 hover:bg-amber-50/70 dark:border-amber-500/15 dark:bg-slate-950/80 dark:hover:border-amber-500/30 dark:hover:bg-amber-950/25",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
      meta: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-300",
      glow: "bg-amber-100/70 dark:bg-amber-500/10",
    },
    rose: {
      card: "border-rose-100 bg-white hover:border-rose-200 hover:bg-rose-50/70 dark:border-rose-500/15 dark:bg-slate-950/80 dark:hover:border-rose-500/30 dark:hover:bg-rose-950/25",
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
      meta: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/45 dark:text-rose-300",
      glow: "bg-rose-100/70 dark:bg-rose-500/10",
    },
  };
  const toneClasses = tones[tone] || tones.sky;

  return (
    <Link
      href={href}
      className={[
        "group relative overflow-hidden rounded-[22px] border p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-3.5",
        toneClasses.card,
        className,
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full blur-3xl",
          toneClasses.glow,
        ].join(" ")}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DashboardIcon tone={tone} className={[toneClasses.icon, "h-10 w-10 rounded-xl"].join(" ")}>
              {icon}
            </DashboardIcon>
            <div
              className={[
                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]",
                toneClasses.meta,
              ].join(" ")}
            >
              {eyebrow}
            </div>
          </div>
          <svg
            className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-slate-600 dark:group-hover:text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div className="mt-3.5">
          <div className="text-base font-black leading-tight tracking-tight text-gray-900 dark:text-slate-100">
            {title}
          </div>
          <p className="mt-1.5 max-w-[30ch] text-[13px] leading-5 text-gray-600 dark:text-slate-400">
            {description}
          </p>
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
          <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
            {meta}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-extrabold text-gray-900 shadow-sm dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-none">
            Open
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function ParentChildCard({ child, index, gwa }) {
  const progression = assessProgression(child.birthDate, gwa?.progressStats);
  const ageLabel = formatAge(child.birthDate);
  const tone =
    progression?.status === "ahead"
      ? "emerald"
      : progression?.status === "behind"
        ? "amber"
        : "sky";
  const tones = {
    sky: {
      card: "border-sky-100 bg-white hover:border-sky-200 hover:bg-sky-50/70 dark:border-sky-500/15 dark:bg-slate-950/80 dark:hover:border-sky-500/30 dark:hover:bg-sky-950/25",
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
      pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/45 dark:text-sky-300",
      progress: "from-sky-500 to-cyan-500",
      glow: "bg-sky-100/80 dark:bg-sky-500/10",
    },
    emerald: {
      card: "border-emerald-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/70 dark:border-emerald-500/15 dark:bg-slate-950/80 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-950/25",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
      pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-300",
      progress: "from-emerald-500 to-teal-500",
      glow: "bg-emerald-100/80 dark:bg-emerald-500/10",
    },
    amber: {
      card: "border-amber-100 bg-white hover:border-amber-200 hover:bg-amber-50/70 dark:border-amber-500/15 dark:bg-slate-950/80 dark:hover:border-amber-500/30 dark:hover:bg-amber-950/25",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
      pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-300",
      progress: "from-amber-500 to-orange-500",
      glow: "bg-amber-100/80 dark:bg-amber-500/10",
    },
  };
  const toneClasses = tones[tone] || tones.sky;
  const progressWidth = Math.max(8, Math.min(Number(gwa?.overall || 0), 100));

  return (
    <Link
      href={`/parent/children?childId=${encodeURIComponent(child.id)}`}
      className={[
        "group relative overflow-hidden rounded-[24px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        toneClasses.card,
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full blur-3xl",
          toneClasses.glow,
        ].join(" ")}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <DashboardIcon tone={tone} className={[toneClasses.icon, "h-10 w-10 rounded-xl"].join(" ")}>
            <span className="text-sm font-black">{initials(child.firstName, child.lastName)}</span>
          </DashboardIcon>
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]",
              progression
                ? toneClasses.pill
                : "border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300",
            ].join(" ")}
          >
            {progression?.label || "Profile"}
          </span>
        </div>

        <div className="mt-3.5">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-slate-100">
            {child.firstName} {child.lastName || ""}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
            Child {index + 1}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ageLabel ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300">
              Age {ageLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300">
            {child.classRoomId ? "Classroom assigned" : "Classroom pending"}
          </span>
        </div>

        {gwa ? (
          <div className="mt-3.5 rounded-[18px] border border-gray-200 bg-white/90 p-3 dark:border-white/10 dark:bg-slate-950/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
                  Overall progress
                </div>
                <div className="mt-1.5 text-xl font-black tracking-tight text-gray-900 dark:text-slate-100">
                  {gwa.overall}%
                </div>
              </div>
              <div className="text-right text-[11px] text-gray-500 dark:text-slate-400">
                {gwa.progressStats?.total ? (
                  <>
                    <div className="font-semibold text-gray-900 dark:text-slate-100">
                      {gwa.progressStats.completed}/{gwa.progressStats.total}
                    </div>
                    <div>steps complete</div>
                  </>
                ) : (
                  <div>Progress syncing</div>
                )}
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
              <div
                className={[
                  "h-full rounded-full bg-gradient-to-r",
                  toneClasses.progress,
                ].join(" ")}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3.5 rounded-[18px] border border-dashed border-gray-300 bg-gray-50 p-3 text-[13px] leading-5 text-gray-600 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-400">
            Progress data is still syncing for this child.
          </div>
        )}

        <div className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-gray-900 transition group-hover:translate-x-0.5 dark:text-slate-100">
          Open full profile
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function ParentDashboard({
  name,
  children,
  selectedChild,
  loading,
  error,
  activities,
  submissions,
  subscriptionSummary,
}) {
  const visibleChildren = (children || []).slice(0, 10);
  const [childGWAs, setChildGWAs] = useState({});
  const childIds = visibleChildren.map((ch) => ch.id).join(",");

  useEffect(() => {
    if (!childIds) return;
    let cancelled = false;
    (async () => {
      const results = {};
      await Promise.all(
        childIds.split(",").map(async (id) => {
          try {
            const [acts, progress] = await Promise.all([
              apiJson(`/api/v1/activities?childId=${encodeURIComponent(id)}`),
              apiJson(`/api/v1/progress?childId=${encodeURIComponent(id)}`),
            ]);
            const gwa = computeChildGWA(
              Array.isArray(acts) ? acts : [],
              Array.isArray(progress) ? progress : [],
            );
            if (gwa !== null) results[id] = gwa;
          } catch {}
        }),
      );
      if (!cancelled) setChildGWAs(results);
    })();
    return () => { cancelled = true; };
  }, [childIds]);

  const [behaviorPlans, setBehaviorPlans] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plans = await apiJson("/api/v1/behavior-plans");
        if (!cancelled) setBehaviorPlans(Array.isArray(plans) ? plans : []);
      } catch {
        if (!cancelled) setBehaviorPlans([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pendingPlanApprovals = useMemo(
    () => behaviorPlans.filter((plan) => !plan.parentApproved),
    [behaviorPlans],
  );

  const reminders = useMemo(() => {
    const reminderItems = (submissions || [])
      .filter((submission) => submission?.expiresAt)
      .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
      .slice(0, 3)
      .map((submission) => {
        const expiresAt = new Date(submission.expiresAt);
        const isExpired = expiresAt < new Date();
        const childLabel = submission.child
          ? `${submission.child.firstName} ${submission.child.lastName || ""}`.trim()
          : "Family account";

        return {
          id: submission.id,
          title: submission.template?.title || "Form renewal",
          detail: childLabel,
          statusLabel: isExpired
            ? "Expired"
            : `Due ${expiresAt.toLocaleDateString()}`,
          tone: isExpired ? "rose" : "amber",
        };
      });

    return reminderItems.length
      ? reminderItems
      : [
          {
            id: "clear",
            title: "All set for now",
            detail: "No urgent renewals right now.",
            statusLabel: "Up to date",
            tone: "emerald",
          },
        ];
  }, [submissions]);

  const recentActivities = (activities || []).slice(0, 3);
  const childrenWithProgress = visibleChildren.filter((child) => childGWAs[child.id]).length;
  const urgentReminderCount = reminders.filter((item) => item.tone !== "emerald").length;
  const billingTone = subscriptionSummary?.active ? "emerald" : subscriptionSummary ? "amber" : "rose";

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-5">
        <div className="grid grid-cols-1 items-start gap-5">
          <ParentPageHeader
            eyebrow="Family overview"
            title={`Welcome back, ${name}`}
            description="See updates, forms, billing, and progress from one parent dashboard."
            accent="amber"
            layout="default"
            stats={[
              {
                label: "Children",
                value: visibleChildren.length,
                hint: "Linked profiles",
                tone: "sky",
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                ),
              },
              {
                label: "Recent updates",
                value: recentActivities.length,
                hint: selectedChild ? `${selectedChild.firstName} feed` : "Latest updates",
                tone: recentActivities.length ? "amber" : "gray",
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022 23.848 23.848 0 005.454 1.31m5.715 0a24.255 24.255 0 01-5.715 0m5.715 0a3 3 0 11-5.715 0" />
                  </svg>
                ),
              },
              {
                label: "Renewals",
                value: urgentReminderCount ? urgentReminderCount : "Clear",
                hint: urgentReminderCount ? "Need review" : "Nothing due",
                tone: urgentReminderCount ? "amber" : "emerald",
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
              {
                label: "Billing",
                value: subscriptionSummary?.active ? "Active" : "Review",
                hint: subscriptionSummary?.centerName || "Center account",
                tone: subscriptionSummary?.active ? "emerald" : "amber",
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M3 10.5h18A1.5 1.5 0 0122.5 12v6A1.5 1.5 0 0121 19.5H3A1.5 1.5 0 011.5 18v-6A1.5 1.5 0 013 10.5z" />
                  </svg>
                ),
              },
            ]}
            actions={
              <>
                <ParentButton href="/parent/messages" variant="secondary" className="px-3 py-2 text-xs">Messages</ParentButton>
                <ParentButton href="/parent/forms" className="px-3 py-2 text-xs">Open forms</ParentButton>
              </>
            }
          />

          {pendingPlanApprovals.length > 0 ? (
            <ParentApprovalAlert plans={pendingPlanApprovals} />
          ) : null}
        </div>

        <ParentSection
          title="Jump back in"
          description="Direct links to the parent tasks you use most."
          className="overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50/70 p-4 shadow-[0_22px_70px_-52px_rgba(14,116,144,0.55)] dark:border-sky-500/20 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/35"
          headerClassName="pb-3"
          bodyClassName="pt-3"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <ParentDashboardActionCard
              href="/parent/messages"
              eyebrow="Communication"
              title="Messages & updates"
              description="See recent teacher notes and jump straight into the parent inbox."
              meta={
                recentActivities.length
                  ? `${recentActivities.length} recent updates`
                  : "Quiet right now"
              }
              tone="sky"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76l2.904-2.482a2.25 2.25 0 012.927 0l2.904 2.482m0 0l2.904-2.482a2.25 2.25 0 012.927 0l2.904 2.482M6.75 19.5h10.5A2.25 2.25 0 0019.5 17.25v-8.379a2.25 2.25 0 00-.786-1.706l-4.5-3.938a2.25 2.25 0 00-2.928 0l-4.5 3.938A2.25 2.25 0 004.5 8.871v8.379A2.25 2.25 0 006.75 19.5z" />
                </svg>
              }
            />
            <ParentDashboardActionCard
              href="/parent/children"
              eyebrow="Profiles"
              title="My children"
              description="Open daily reports, milestones, meals, and classroom information for each child."
              meta={`${visibleChildren.length} linked profiles`}
              tone="emerald"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-1.052 4.5 4.5 0 00-7.482-3.09m.259 3.008A8.958 8.958 0 0112 18c-2.21 0-4.233-.798-5.797-2.121m8.056 1.129A8.966 8.966 0 0112 18c-2.21 0-4.233-.798-5.797-2.121m0 0A5.969 5.969 0 016 12.75a5.969 5.969 0 01.203-1.543m0 0a3.75 3.75 0 117.594 0m-7.594 0a5.969 5.969 0 00-.203 1.543m7.797-1.543a3.75 3.75 0 117.594 0m-7.594 0a5.969 5.969 0 01.203 1.543" />
                </svg>
              }
            />
            <ParentDashboardActionCard
              href="/parent/progress"
              eyebrow="Growth"
              title="Progress & goals"
              description="Check completed steps and see where support is still needed across your family."
              meta={`${childrenWithProgress} summaries ready`}
              tone="amber"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7.5 14.25l3-3 2.25 2.25L16.5 9" />
                </svg>
              }
            />
            <ParentDashboardActionCard
              href="/parent/billing"
              eyebrow="Account"
              title="Billing & support"
              description="Review plan status, expiry dates, and support options without leaving the dashboard."
              meta={subscriptionSummary?.active ? "Account in good standing" : "Needs review"}
              tone={billingTone}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M3 10.5h18A1.5 1.5 0 0122.5 12v6A1.5 1.5 0 0121 19.5H3A1.5 1.5 0 011.5 18v-6A1.5 1.5 0 013 10.5zM16.5 15h.008v.008H16.5V15z" />
                </svg>
              }
            />
          </div>
        </ParentSection>

        <ParentSection
          title="Children at a glance"
          description="Each profile card gives you a fast read on progress, age, and what to open next."
          action={<ParentButton href="/parent/children" variant="soft" className="px-3 py-2 text-xs">View all children</ParentButton>}
          className="overflow-hidden border-amber-100 bg-gradient-to-br from-white via-white to-amber-50/70 p-4 shadow-[0_24px_70px_-52px_rgba(217,119,6,0.45)] dark:border-amber-500/20 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/30"
          headerClassName="pb-3"
          bodyClassName="pt-3"
        >
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4"><Skeleton count={4} /></div>
          ) : visibleChildren.length === 0 ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-400">
              No children found for this account.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleChildren.map((ch, index) => (
                <ParentChildCard
                  key={ch.id}
                  child={ch}
                  index={index}
                  gwa={childGWAs[ch.id]}
                />
              ))}
            </div>
          )}
        </ParentSection>
      </section>

      <aside className="space-y-3">
          <ParentDashboardPanel
            eyebrow="Alerts"
            title="Recent updates"
            description="Short updates you can scan quickly."
            accent="amber"
          >
            <div className="space-y-2.5">
              {recentActivities.length ? (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-[18px] border border-gray-200 bg-gradient-to-r from-white to-sky-50/70 p-3 dark:border-white/10 dark:from-slate-950 dark:to-sky-950/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-extrabold text-gray-900 dark:text-slate-100">
                          {activity.type}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-gray-600 dark:text-slate-400">
                          {activity.notes || "No extra details were added to this update."}
                        </div>
                      </div>
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em]",
                          activity.isBackdated
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-300"
                            : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/45 dark:text-sky-300",
                        ].join(" ")}
                      >
                        {activity.isBackdated ? "Backdated" : "Update"}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-500">
                      {formatDashboardTimestamp(activity.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-gray-300 bg-gray-50 p-3 text-[13px] leading-5 text-gray-600 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-400">
                  No new alerts right now.
                </div>
              )}
            </div>

            <ParentButton href="/parent/messages" variant="secondary" className="mt-3 w-full px-3 py-2 text-xs">
              Open messages
            </ParentButton>
          </ParentDashboardPanel>
      </aside>
    </div>
  );
}

function initials(firstName, lastName) {
  const f = (firstName || "").trim().slice(0, 1).toUpperCase();
  const l = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${f}${l}` || "C";
}

function QuickTile({ title, subtitle, href, disabled = false }) {
  if (disabled) {
    return (
      <div className="rounded-[24px] border border-gray-200 bg-slate-50 p-4">
        <div className="font-extrabold text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
        <div className="mt-2 text-xs font-semibold text-gray-500">
          Not available for your role
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-[24px] border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-sm"
    >
      <div className="font-extrabold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
    </Link>
  );
}

function Shortcut({ href, label }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-center font-semibold text-gray-800 transition hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}

function DashboardStatCard({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-100 bg-sky-50/90",
    emerald: "border-emerald-100 bg-emerald-50/90",
    amber: "border-amber-100 bg-amber-50/90",
  };

  return (
    <div className={`rounded-[24px] border p-4 ${tones[tone] || tones.sky}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{hint}</div>
    </div>
  );
}
