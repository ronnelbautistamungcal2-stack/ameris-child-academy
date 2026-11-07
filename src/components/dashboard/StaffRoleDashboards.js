import {
  CenterSelect,
  ClassroomsAtGlance,
  DashboardCalendar,
  DashboardWelcome,
  NAVY,
  PanelHeading,
  StatBubble,
  ViewAll,
  panel,
  useDashboardCenters,
  useDashboardSummary,
  useUnreadMessages,
} from "@/components/dashboard/RoleDashboard";
import { apiJson } from "@/lib/api";
import { SOP_STATUSES } from "@/lib/sop";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Kitchen, Student Support, HR and Other Staff dashboards (client mockups
// 03-Dashboards 16, 17 and 19; Other Staff: client sheet 2026-11-07), shown on
// /staff/dashboard for those roles.

function Avatar({ name, photoUrl }) {
  if (photoUrl) return <img src={photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  const initials = String(name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">{initials}</span>;
}

function Shell({ children, error }) {
  return (
    <div className="space-y-5">
      {children[0]}
      {error ? <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {children.slice(1)}
    </div>
  );
}

const MEAL_STYLE = {
  breakfast: { icon: "☀️", box: "bg-amber-50 dark:bg-amber-900/20", title: "text-orange-600" },
  lunch: { icon: "\u{1F374}", box: "bg-emerald-50 dark:bg-emerald-900/20", title: "text-emerald-700" },
  dinner: { icon: "\u{1F37D}️", box: "bg-sky-50 dark:bg-sky-900/20", title: "text-sky-700" },
};
const SNACK_STYLE = { icon: "\u{1F34E}", box: "bg-violet-50 dark:bg-violet-900/20", title: "text-violet-700" };

/** Other Staff: the welcome line, New Messages and the center calendar. */
export function OtherStaffDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const unread = useUnreadMessages();
  return (
    <Shell error="">
      <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatBubble kind="messages" icon={"✉️"} value={unread} label="New Messages" href="/staff/messages" />
      </div>
      {centerId ? <DashboardCalendar centerId={centerId} /> : null}
    </Shell>
  );
}

export function KitchenDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const { data, error } = useDashboardSummary("kitchen", centerId);
  const unread = useUnreadMessages();
  const [showAll, setShowAll] = useState(false);
  const allergies = data?.allergies || [];
  const shown = showAll ? allergies : allergies.slice(0, 6);

  return (
    <Shell error={error}>
      <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatBubble kind="redFlags" icon={"\u{1F6A9}"} value={data ? data.allergyUpdates : "…"} label="Allergy Updates" href="#food-allergies" />
        <StatBubble kind="infantPlanUpdates" icon={"\u{1F37C}"} value={data ? data.feedingUpdates : "…"} label="Infant Feeding Updates" href="/staff/kitchen/infant-feeding-plan" />
        <StatBubble kind="messages" icon={"✉️"} value={unread} label="New Messages" href="/staff/messages" />
      </div>
      {centerId ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <DashboardCalendar centerId={centerId} />
          <section className={panel}>
            <PanelHeading icon={"\u{1F374}"} title="Today's Menu" action={<ViewAll href="/staff/kitchen/menus" label="View Full Menu" />} />
            {data?.menu?.length ? (
              <div className="space-y-3">
                {data.menu.map((m) => {
                  const style = MEAL_STYLE[m.key] || SNACK_STYLE;
                  return (
                    <div key={m.key} className={`flex gap-3 rounded-xl p-3 ${style.box}`}>
                      <span aria-hidden className="text-2xl">{style.icon}</span>
                      <div>
                        <div className={`font-black ${style.title}`}>{m.label}</div>
                        <ul className="mt-1 list-disc pl-5 text-sm text-gray-800 dark:text-gray-200">
                          {m.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{data ? "No menu planned for today." : "Loading..."}</p>
            )}
          </section>
        </div>
      ) : null}
      {centerId ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <section id="food-allergies" className={panel}>
            <PanelHeading
              icon={"➕"}
              title="Food Allergies"
              action={
                allergies.length > 6 ? (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-bold text-blue-700 hover:underline dark:text-blue-300">
                    {showAll ? "Show Less" : `View All (${allergies.length})`}
                  </button>
                ) : null
              }
            />
            {shown.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sky-50 text-left text-xs font-bold text-gray-700 dark:bg-sky-900/30 dark:text-gray-300">
                      <th className="px-3 py-2">Child</th>
                      <th className="px-3 py-2">Allergens</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shown.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2">
                          <span className={`flex items-center gap-2 ${NAVY}`}>
                            <Avatar name={c.name} photoUrl={c.photoUrl} />
                            {c.name}
                            {c.updated ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">Updated</span> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap gap-1">
                            {c.allergens.map((a) => (
                              <span key={a} className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                                {a}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{c.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{data ? "No food allergies recorded." : "Loading..."}</p>
            )}
          </section>
          <ClassroomsAtGlance rows={data?.classrooms || []} showTeachers={false} />
        </div>
      ) : null}
    </Shell>
  );
}

function StatusPill({ status, areas }) {
  const meta = SOP_STATUSES.find((s) => s.value === status);
  if (!meta) return <span className="text-xs text-gray-500">—</span>;
  return (
    <span className={`inline-block rounded-md px-2 py-1 text-xs font-bold ${meta.pill}`}>
      {meta.label}
      {areas?.length ? <span className="block font-normal">{areas.join(", ")}</span> : null}
    </span>
  );
}

export function StudentSupportDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const { data, error } = useDashboardSummary("support", centerId);
  const report = (id) => `/staff/student-support/student-performance?childId=${encodeURIComponent(id)}`;

  return (
    <Shell error={error}>
      <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
      {centerId ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <DashboardCalendar centerId={centerId} />
          <div className="space-y-4">
            <section className={panel}>
              <PanelHeading
                icon={"⚠️"}
                title="Student Performance Alerts"
                subtitle="Students with a character grade between 0-2 or any milestone at Critical."
                action={<ViewAll href="/staff/student-support/progression-tracking" />}
              />
              {data?.alerts?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-sky-50 text-left text-xs font-bold text-gray-700 dark:bg-sky-900/30 dark:text-gray-300">
                        <th className="px-3 py-2">Child</th>
                        <th className="px-3 py-2">Age/Room</th>
                        <th className="px-3 py-2">Character Grade</th>
                        <th className="px-3 py-2">Milestone Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.alerts.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2">
                            <Link href={report(c.id)} className={`flex items-center gap-2 hover:underline ${NAVY}`}>
                              <Avatar name={c.name} photoUrl={c.photoUrl} />
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                            {c.age}
                            <span className="block">{c.room}</span>
                          </td>
                          <td className="px-3 py-2">
                            {c.grade != null ? (
                              <span className={`inline-block min-w-[2rem] rounded-md px-2 py-1 text-center font-black ${c.grade <= 2 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{c.grade}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={c.status} areas={c.critical} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{data ? "No students need attention right now." : "Loading..."}</p>
              )}
            </section>
            <section className={panel}>
              <PanelHeading
                icon={"\u{1F9D1}‍\u{1F91D}‍\u{1F9D1}"}
                title="Students on IPP"
                subtitle="Students with an active Individual Progress Plan (IPP)."
                action={<ViewAll href="/staff/student-support/progress-plans" />}
              />
              {data?.ipps?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-sky-50 text-left text-xs font-bold text-gray-700 dark:bg-sky-900/30 dark:text-gray-300">
                        <th className="px-3 py-2">Child</th>
                        <th className="px-3 py-2">Age/Room</th>
                        <th className="px-3 py-2">Primary Focus</th>
                        <th className="px-3 py-2">Review Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.ipps.map((p) => (
                        <tr key={p.planId}>
                          <td className="px-3 py-2">
                            <Link href={report(p.id)} className={`flex items-center gap-2 hover:underline ${NAVY}`}>
                              <Avatar name={p.name} photoUrl={p.photoUrl} />
                              {p.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                            {p.age}
                            <span className="block">{p.room}</span>
                          </td>
                          <td className={`px-3 py-2 ${NAVY}`}>{p.focus}</td>
                          <td className={`px-3 py-2 ${NAVY}`}>{p.reviewDate ? new Date(`${p.reviewDate}T00:00:00`).toLocaleDateString("en-US") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{data ? "No students on an IPP." : "Loading..."}</p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

// Staff Current HR Grade: staff with hours worked under 80%, more than 2
// lates, or any absence (client mockup), over the last 30 days.
const needsHrAttention = (s) => (s.hrPct != null && s.hrPct < 80) || s.lates > 2 || s.absences > 0;

export function HrDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return undefined;
    let live = true;
    setStaff(null);
    setError("");
    apiJson(`/api/v1/reports/center-performance?staffOnly=1&centerId=${encodeURIComponent(centerId)}`)
      .then((d) => live && setStaff(d.staff || []))
      .catch((e) => live && setError(e.message || "Could not load staff grades"));
    return () => {
      live = false;
    };
  }, [centerId]);

  const rows = useMemo(() => (staff || []).filter(needsHrAttention), [staff]);

  return (
    <Shell error={error}>
      <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
      {centerId ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <DashboardCalendar centerId={centerId} />
          <section className={panel}>
            <PanelHeading
              icon={"\u{1F465}"}
              title="Staff Current HR Grade"
              subtitle="Showing staff with % Hours Worked < 80%, or > 2 lates, or > 0 absences (last 30 days)."
              action={<ViewAll href="/staff/hr/staff-performance" label="Open" />}
            />
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sky-50 text-left text-xs font-bold text-gray-700 dark:bg-sky-900/30 dark:text-gray-300">
                      <th className="px-3 py-2">Staff Member</th>
                      <th className="px-3 py-2">% Hours Worked</th>
                      <th className="px-3 py-2"># Lates</th>
                      <th className="px-3 py-2"># Absences</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td className={`px-3 py-2 ${NAVY}`}>{s.name}</td>
                        <td className="px-3 py-2">
                          {s.hrPct != null ? (
                            <span className={`inline-block rounded-md px-2 py-1 font-bold ${s.hrPct < 80 ? "bg-red-100 text-red-700" : s.hrPct < 90 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"}`}>
                              {s.hrPct}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`px-3 py-2 ${NAVY}`}>{s.lates}</td>
                        <td className={`px-3 py-2 ${NAVY}`}>{s.absences}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{staff ? "No staff need attention right now." : "Loading..."}</p>
            )}
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
