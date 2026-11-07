import { useHasAddOns } from "@/components/subscription/AddOnGate";
import TeacherCalendarPanel from "@/components/teacher/TeacherCalendarPanel";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { ADD_ON_LABELS } from "@/lib/addOns";
import { apiJson } from "@/lib/api";
import { DASHBOARD_BUBBLES } from "@/lib/dashboardBubbles";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Shared pieces of the role dashboards (client mockups 03-Dashboards): the
// welcome line and clock, stat bubbles, the month calendar and the
// "Classrooms at a Glance" table.

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";
export const panel = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** "Welcome, Bonnie!" with today's date and time on the right. */
export function DashboardWelcome({ controls = null }) {
  const { data: session } = useSession();
  const now = useNow();
  const first = String(session?.user?.name || "").trim().split(/\s+/)[0];
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className={`text-3xl font-black sm:text-4xl ${NAVY}`}>{first ? `Welcome, ${first}!` : "Welcome!"}</h1>
        <p className={`mt-1 text-lg ${NAVY}`}>Thank you for making a difference every day!</p>
        {controls ? <div className="mt-3">{controls}</div> : null}
      </div>
      <div className="rounded-2xl bg-sky-50 px-6 py-3 text-center dark:bg-sky-900/30" data-testid="dashboard-clock">
        <div className={`text-sm font-semibold ${NAVY}`}>
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
        <div className={`text-3xl font-black ${NAVY}`}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
      </div>
    </div>
  );
}

/** A stat bubble in the shared colour for its kind (messages, redFlags, ...). */
/** addOn: the add-on the bubble needs; without it the bubble is greyed out with a lock. */
export function StatBubble({ kind, icon, value, label, href, addOn }) {
  const c = DASHBOARD_BUBBLES[kind] || DASHBOARD_BUBBLES.messages;
  const locked = !useHasAddOns(addOn ? [addOn] : []);
  if (locked) {
    const name = ADD_ON_LABELS[addOn] || addOn;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 opacity-70 dark:border-gray-700 dark:bg-gray-900" title={`Part of the ${name} add-on`} data-testid={`bubble-${kind}`}>
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-2xl dark:bg-gray-800">{"\u{1F512}"}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-600 dark:text-gray-300">{label}</span>
          <span className="block text-xs text-gray-500">Part of the {name} add-on</span>
        </span>
      </div>
    );
  }
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-2xl border p-4 transition ${c.card}`} data-testid={`bubble-${kind}`}>
      <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${c.icon}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-2xl font-black ${c.value}`}>{value}</span>
        <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      </span>
      <span aria-hidden className={`text-xl text-gray-400 ${c.arrow}`}>›</span>
    </Link>
  );
}

export function PanelHeading({ icon, title, subtitle, action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className={`flex items-center gap-2 text-lg font-black ${NAVY}`}>
          <span aria-hidden>{icon}</span>
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ViewAll({ href, label = "View All" }) {
  return (
    <Link href={href} className="shrink-0 text-sm font-bold text-blue-700 hover:underline dark:text-blue-300">
      {label} ›
    </Link>
  );
}

export function DashboardCalendar({ centerId }) {
  return (
    <section className={panel}>
      <TeacherCalendarPanel centerId={centerId} title="Calendar" />
    </section>
  );
}

/** Each classroom's children in / capacity and, optionally, the teachers signed in. */
export function ClassroomsAtGlance({ rows = [], showTeachers = true, viewAllHref = null }) {
  return (
    <section className={panel}>
      <PanelHeading icon={"\u{1F465}"} title="Classrooms at a Glance" action={viewAllHref ? <ViewAll href={viewAllHref} /> : null} />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50 text-left text-xs font-bold text-gray-700 dark:bg-sky-900/30 dark:text-gray-300">
                <th className="px-3 py-2">Classroom</th>
                <th className="px-3 py-2">Children In</th>
                {showTeachers ? <th className="px-3 py-2">Teacher(s) Signed In</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`px-3 py-2 ${NAVY}`}>{r.name}</td>
                  <td className={`px-3 py-2 ${NAVY}`}>
                    {r.childrenIn} / {r.capacity || 0}
                  </td>
                  {showTeachers ? <td className={`px-3 py-2 ${NAVY}`}>{r.teachersIn.join(", ") || "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No classrooms at this center yet.</p>
      )}
    </section>
  );
}

/** GET /api/v1/dashboard/summary for one dashboard and center. */
export function useDashboardSummary(view, centerId) {
  const [state, setState] = useState({ data: null, error: "" });
  useEffect(() => {
    if (!centerId) return undefined;
    let live = true;
    setState({ data: null, error: "" });
    apiJson(`/api/v1/dashboard/summary?view=${view}&centerId=${encodeURIComponent(centerId)}`)
      .then((data) => live && setState({ data, error: "" }))
      .catch((e) => live && setState({ data: null, error: e.message || "Could not load the dashboard" }));
    return () => {
      live = false;
    };
  }, [view, centerId]);
  return state;
}

/** Unread messages across the signed-in user's threads. */
export function useUnreadMessages() {
  const [threads, setThreads] = useState([]);
  useEffect(() => {
    apiJson("/api/v1/messages/threads")
      .then((t) => setThreads(Array.isArray(t) ? t : []))
      .catch(() => setThreads([]));
  }, []);
  return useMemo(() => threads.reduce((sum, t) => sum + Number(t?.unreadCount || 0), 0), [threads]);
}

/** A center picker for people who work at more than one center. */
export function CenterSelect({ centers, centerId, onChange }) {
  if (centers.length < 2) return null;
  return (
    <select
      aria-label="Center"
      value={centerId}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
    >
      {centers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** Centers the user can see, with the selection kept in the URL like the other dashboards. */
export function useDashboardCenters() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  useSyncedCenterId(centerId, setCenterId, centers);
  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((c) => setCenters(Array.isArray(c) ? c : []))
      .catch(() => setCenters([]));
  }, []);
  // Pick the first center when nothing is chosen yet.
  useEffect(() => {
    if (!centerId && centers.length) setCenterId(centers[0].id);
  }, [centerId, centers]);
  return { centers, centerId, setCenterId };
}
