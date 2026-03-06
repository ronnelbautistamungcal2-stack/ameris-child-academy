import { useSession } from "next-auth/react";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import AppShell from "@/components/shell/AppShell";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";

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
    if (session?.user?.role === "COACH") {
      router.replace("/coach/dashboard");
    }
  }, [status, session?.user?.role, router]);

  const nav = useMemo(() => {
    if (role === "ADMIN") return ADMIN_NAV_ITEMS;
    if (role === "TEACHER") return TEACHER_NAV_ITEMS;
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
        const c = await apiJson("/api/v1/centers");
        const centersArr = Array.isArray(c) ? c : [];
        setCenters(centersArr);

        if (role === "PARENT") {
          const kids = await apiJson("/api/v1/children");
          const kidsArr = Array.isArray(kids) ? kids : [];
          setChildren(kidsArr);
          setChildId(kidsArr[0]?.id || "");
        } else {
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
      showBack={false}
    >
      {role === "PARENT" ? (
        <ParentDashboard
          name={name}
          children={children}
          loading={loading}
          error={error}
          activities={activities}
          subscriptionSummary={subscriptionSummary}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700/70">
                      Welcome back
                    </div>
                    <h2 className="mt-1 truncate text-2xl font-extrabold text-gray-900">
                      {name}!
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {role === "PARENT"
                        ? "Your children are ready for a great day."
                        : role === "TEACHER"
                          ? "Jump into daily logging, lessons, and checklists."
                          : role === "ADMIN"
                            ? "Manage classrooms, students, and staff — with full control."
                            : "Welcome."}
                    </p>
                  </div>

                  {(role === "ADMIN" || role === "TEACHER") && centers.length ? (
                    <div className="w-full max-w-xs">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Center
                      </div>
                      <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
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
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">
                      {role === "PARENT" ? "My Children" : "Children"}
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
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {children.slice(0, 8).map((ch) => {
                      const active = ch.id === childId;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setChildId(ch.id)}
                          className={[
                            "rounded-2xl border p-4 text-left transition",
                            active
                              ? "border-blue-200 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-extrabold text-gray-700">
                              {initials(ch.firstName, ch.lastName)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-gray-900">
                                {ch.firstName} {ch.lastName || ""}
                              </div>
                              <div className="truncate text-xs text-gray-500">
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

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-gray-900">
                  Enrollment & Policies
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Quick links to documents, policies, and training resources.
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

            <aside className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
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
                        className="rounded-xl border border-gray-200 bg-gray-50 p-3"
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
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      Select a child to view recent activity.
                    </div>
                  )}
                </div>

                {role === "TEACHER" && childId ? (
                  <Link
                    href={`/teacher/logs?centerId=${encodeURIComponent(centerId || "")}&childId=${encodeURIComponent(childId)}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
                  >
                    Log Activity
                  </Link>
                ) : role === "ADMIN" && childId ? (
                  <Link
                    href={`/admin/activity-overrides?centerId=${encodeURIComponent(centerId || "")}&childId=${encodeURIComponent(childId)}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
                  >
                    Override Activity
                  </Link>
                ) : null}
              </div>

              {role === "PARENT" ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
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
                      <button
                        type="button"
                        className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
                        onClick={() => alert("Billing flow not implemented yet")}
                      >
                        Pay Now
                      </button>
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
                    <Shortcut href="/admin/teachers" label="Teachers" />
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
  language: "bg-pink-400",
  creative: "bg-violet-400",
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
  { name: "Language & Literacy", color: "bg-pink-400" },
  { name: "Creative", color: "bg-violet-400" },
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
      overallGrades.push((Number(details.grade) / 5) * 100);
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

function ParentDashboard({
  name,
  children,
  loading,
  error,
  activities,
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

  const reminders = [
    "Admission agreement renewal due this month.",
    "Health assessment renewal due soon.",
    "Income eligibility review coming up.",
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700/70">
            Welcome back
          </div>
          <h2 className="mt-1 truncate text-2xl font-extrabold text-gray-900">
            {name}!
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Your children are currently checked in and having a great day.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-extrabold text-gray-900">
            Policies and Procedures
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickTile
              title="Parent Handbook"
              subtitle="Policies, procedures, and guidelines"
              href="/parent/policies"
            />
            <QuickTile
              title="Parent Enrollment Documents"
              subtitle="Submit and review enrollment forms"
              href="/parent/forms"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-extrabold text-gray-900">
            Parent Enrollment Documents
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/parent/forms"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Admission Agreement
            </Link>
            <Link
              href="/parent/forms"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Health Assessment
            </Link>
            <Link
              href="/parent/forms"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Income Eligibility Form
            </Link>
            <Link
              href="/parent/forms"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Baby Forms
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">My Children</h3>
              <p className="mt-1 text-sm text-gray-600">
                Click on each child to view their page.
              </p>
            </div>
            <Link
              href="/parent/children"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View All
            </Link>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4"><Skeleton count={4} /></div>
          ) : visibleChildren.length === 0 ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No children found for this account.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {visibleChildren.map((ch, index) => (
                <Link
                  key={ch.id}
                  href={`/parent/children?childId=${encodeURIComponent(ch.id)}`}
                  className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-extrabold text-gray-700">
                    {initials(ch.firstName, ch.lastName)}
                  </div>
                  <div className="mt-2 truncate text-sm font-extrabold text-gray-900">
                    {ch.firstName} {ch.lastName || ""}
                  </div>
                  <div className="text-xs text-gray-500">Child {index + 1}</div>
                  {childGWAs[ch.id] != null ? (
                    <ChildGWACard gwa={childGWAs[ch.id]} birthDate={ch.birthDate} />
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-extrabold text-gray-900">
            New Messages/Alerts
          </h3>
          <div className="mt-3 space-y-2">
            {(activities || []).slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">{a.type}</div>
                <div className="mt-1 text-xs text-gray-600">{a.notes || "-"}</div>
              </div>
            ))}
            {(activities || []).length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No new alerts right now.
              </div>
            ) : null}
          </div>
          <Link
            href="/parent/messages"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Go to Messages
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-extrabold text-gray-900">
            Forms Renewal Reminders
          </h3>
          <div className="mt-3 space-y-2">
            {reminders.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-gray-900">Account Balance</h3>
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
                    : "-"}
                </span>
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
                onClick={() => alert("Billing flow not implemented yet")}
              >
                Pay Now
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              Billing details not available yet.
            </div>
          )}
        </div>
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
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
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
      className="block rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
    >
      <div className="font-extrabold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
    </Link>
  );
}

function ChildGWACard({ gwa, birthDate }) {
  if (!gwa) return null;

  const progression = assessProgression(birthDate, gwa.progressStats);
  const ageLabel = formatAge(birthDate);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-600">GWA</span>
        <span
          className={[
            "text-xs font-extrabold",
            gwa.overall >= 75
              ? "text-emerald-600"
              : gwa.overall >= 50
                ? "text-amber-600"
                : "text-rose-600",
          ].join(" ")}
        >
          {gwa.overall}%
        </span>
      </div>
      {ageLabel && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Age</span>
          <span className="text-[10px] font-semibold text-gray-700">{ageLabel}</span>
        </div>
      )}
      {gwa.progressStats && gwa.progressStats.total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Steps</span>
          <span className="text-[10px] font-semibold text-gray-700">
            {gwa.progressStats.completed}/{gwa.progressStats.total} ({gwa.progressStats.completionRate}%)
          </span>
        </div>
      )}
      {progression && (
        <div className={[
          "mt-1 rounded-lg border px-2 py-1 text-center text-[10px] font-extrabold",
          progression.bg,
          progression.border,
          progression.color,
        ].join(" ")}>
          {progression.label}
        </div>
      )}
    </div>
  );
}

function Shortcut({ href, label }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center font-semibold text-gray-800 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}
