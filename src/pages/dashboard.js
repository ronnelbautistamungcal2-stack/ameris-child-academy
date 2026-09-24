import { useSession } from "next-auth/react";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { buildParentMessageComposeHref } from "@/lib/parentSupport";
import {
  CalendarCard,
  ImportantNoticesCard,
  MyChildrenCard,
  TodaysMenuCard,
} from "@/components/parent/ParentHomeCards";
import { ageInMonths } from "@/lib/ageUtils";
import { getMenuForDate } from "@/lib/menuPlan";
import { buildParentNotices } from "@/lib/parentNotices";
import { ParentButton } from "@/components/parent/ParentUI";
import { useShellTitle } from "@/components/shell/PortalShell";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useShellTitle("Dashboard");

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
    <>
      {role === "PARENT" ? (
        <ParentDashboard
          centers={centers}
          children={children}
          loading={loading}
          error={error}
          submissions={submissions}
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
                    href={`/coach/activity-overrides?centerId=${encodeURIComponent(centerId || "")}&childId=${encodeURIComponent(childId)}`}
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
                    <Shortcut href="/coach/teachers" label="Staff" />
                    <Shortcut href="/admin/children" label="Students" />
                    <Shortcut href="/coach/classes" label="Classrooms" />
                    <Shortcut href="/admin/lessons" label="Lessons" />
                    <Shortcut href="/admin/subscriptions" label="Subscriptions" />
                  </div>
                </div>
              ) : null}
        </aside>
      </div>
      )}

      {role === "PARENT" ? null : (
        <div className="mt-4 text-xs text-gray-500">
          User ID: <span className="font-mono">{session?.user?.id}</span>
        </div>
      )}
    </>
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

function ParentDashboard({ centers, children, loading, error, submissions }) {
  const childList = useMemo(() => children || [], [children]);
  const centerId = centers?.[0]?.id || "";

  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [behaviorPlans, setBehaviorPlans] = useState([]);

  // Events drive both the calendar grid and the date-based notices.
  useEffect(() => {
    if (!centerId) {
      setEvents([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 1, 1);
      const to = new Date();
      to.setMonth(to.getMonth() + 4, 0);

      try {
        const list = await apiJson(
          "/api/v1/events?centerId=" +
            encodeURIComponent(centerId) +
            "&from=" +
            from.toISOString() +
            "&to=" +
            to.toISOString(),
        );
        if (!cancelled) setEvents(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [centerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson("/api/v1/notifications?limit=10");
        if (!cancelled) {
          setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
        }
      } catch {
        if (!cancelled) setNotifications([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingPlanApprovals = useMemo(
    () => behaviorPlans.filter((plan) => !plan.parentApproved),
    [behaviorPlans],
  );

  const classroomNames = useMemo(() => {
    const map = new Map();
    (centers || []).forEach((center) => {
      (center.classes || []).forEach((room) => {
        if (room?.id) map.set(room.id, room.name);
      });
    });
    return map;
  }, [centers]);

  const childRows = useMemo(
    () =>
      childList.map((child) => {
        const months = ageInMonths(child.birthDate);
        const ageLabel =
          months === null || months < 0
            ? ""
            : months < 24
              ? "Age " + months + " mo"
              : "Age " + Math.floor(months / 12);
        const classLabel = classroomNames.get(child.classRoomId) || "";

        return {
          id: child.id,
          name: [child.firstName, child.lastName].filter(Boolean).join(" "),
          initials: initials(child.firstName, child.lastName),
          meta: [ageLabel, classLabel].filter(Boolean).join("  |  ") || "View profile",
        };
      }),
    [childList, classroomNames],
  );

  const notices = useMemo(
    () => buildParentNotices({ events, submissions, notifications }),
    [events, submissions, notifications],
  );

  const menuRows = useMemo(() => getMenuForDate(new Date()), []);

  return (
    <div className="space-y-4">
      {pendingPlanApprovals.length > 0 ? (
        <ParentApprovalAlert plans={pendingPlanApprovals} />
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <ImportantNoticesCard notices={notices} loading={loading} />
          <MyChildrenCard childRows={childRows} loading={loading} error={error} />
        </div>

        <div className="space-y-4">
          <CalendarCard events={events} />
          <TodaysMenuCard rows={menuRows} />
        </div>
      </div>
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
