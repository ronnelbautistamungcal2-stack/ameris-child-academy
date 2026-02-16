import { useSession } from "next-auth/react";
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
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
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
          session={session}
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
                  <div className="mt-4 text-sm text-gray-600">Loading…</div>
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

function ParentDashboard({
  name,
  session,
  children,
  loading,
  error,
  activities,
  subscriptionSummary,
}) {
  const visibleChildren = (children || []).slice(0, 10);
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
          <h3 className="text-base font-extrabold text-gray-900">Parent Profile</h3>
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              User Name
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {session?.user?.name || session?.user?.email || "Parent"}
            </div>
            <Link
              href="/settings"
              className="mt-3 inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Reset Password
            </Link>
          </div>
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
            <div className="mt-4 text-sm text-gray-600">Loading...</div>
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
