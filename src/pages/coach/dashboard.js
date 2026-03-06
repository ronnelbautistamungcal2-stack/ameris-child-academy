import CoachLayout from "@/components/coach/CoachLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function CoachDashboard() {
  const [data, setData] = useState(null);
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await apiJson(`/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`);
        setData(res);
      } catch (e) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const overdueAlarms = data?.overdueAlarms || [];
  const teachers = data?.teachers || [];
  const checklistSummary = data?.checklistSummary || [];
  const followUpCounts = data?.followUpCounts || {};
  const recentObservations = data?.recentObservations || [];

  return (
    <CoachLayout title="Coach Dashboard">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700/70">
              Coach Dashboard
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
              Teacher Oversight
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Monitor teachers, classrooms, checklists, and follow-ups.
            </p>
          </div>
          {centers.length > 0 && (
            <div className="w-full max-w-xs">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!centerId && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            Select a center to view the dashboard.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {centerId && loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <SkeletonTable rows={5} cols={4} />
          </div>
        )}

        {centerId && !loading && data && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {/* Overdue Alarms */}
              {overdueAlarms.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="text-base font-extrabold text-red-900">
                    Overdue Checklist Alarms ({overdueAlarms.length})
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    These items have passed their due date without completion.
                  </p>
                  <div className="mt-3 space-y-2">
                    {overdueAlarms.map((alarm) => (
                      <div key={alarm.id} className="rounded-xl border border-red-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-gray-900">{alarm.title}</div>
                          <PriorityBadge priority={alarm.priority} />
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Plan: {alarm.plan?.title || "—"} | Due: {fmtDate(alarm.dueAt)}
                        </div>
                        {alarm.assignedTo && (
                          <div className="mt-1 text-xs text-gray-500">
                            Assigned to: {alarm.assignedTo.name || alarm.assignedTo.email}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers & Classrooms */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">
                      Teachers & Classrooms
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Who is in what classroom.
                    </p>
                  </div>
                  <Link
                    href="/coach/messages"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Message
                  </Link>
                </div>

                {teachers.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    No teachers found for this center.
                  </div>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Teacher</th>
                          <th className="px-4 py-3">Classrooms</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {teachers.map((t) => (
                          <tr key={t.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-extrabold text-indigo-700">
                                  {initials(t.name)}
                                </div>
                                <div>
                                  <div className="font-extrabold text-gray-900">{t.name || t.email}</div>
                                  <div className="text-xs text-gray-500">{t.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {t.classrooms?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {t.classrooms.map((cr) => (
                                    <span key={cr.id} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                                      {cr.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No classroom</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Link
                                  href={`/coach/observations?teacherId=${t.id}&centerId=${centerId}`}
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                  Observe
                                </Link>
                                <Link
                                  href={`/coach/follow-ups?assignedToId=${t.id}&centerId=${centerId}`}
                                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                  Follow-up
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Checklist Status */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">Checklist Status</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Items done for each active checklist plan.
                    </p>
                  </div>
                  <Link
                    href={`/coach/checklists?centerId=${centerId}`}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Manage
                  </Link>
                </div>

                {checklistSummary.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    No active checklist plans.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {checklistSummary.map((plan) => {
                      const pct = plan.totalItems ? Math.round((plan.completedItems / plan.totalItems) * 100) : 0;
                      return (
                        <div key={plan.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-extrabold text-gray-900">{plan.title}</div>
                            <span className="text-xs font-semibold text-gray-500">{plan.period}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-extrabold text-gray-700">
                              {plan.completedItems}/{plan.totalItems}
                            </span>
                          </div>
                          {plan.items.filter((it) => it.priority === "CRITICAL" || it.priority === "HIGH").length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {plan.items
                                .filter((it) => it.priority === "CRITICAL" || it.priority === "HIGH")
                                .map((it) => (
                                  <span key={it.id} className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    <PriorityDot priority={it.priority} /> {it.title}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              {/* Quick Stats */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-gray-900">Quick Stats</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <StatCard label="Teachers" value={teachers.length} color="text-indigo-600" />
                  <StatCard label="Alarms" value={overdueAlarms.length} color={overdueAlarms.length > 0 ? "text-red-600" : "text-gray-600"} />
                  <StatCard label="Parent F/U" value={followUpCounts.PARENT || 0} color="text-amber-600" />
                  <StatCard label="Observations" value={recentObservations.length} color="text-emerald-600" />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-gray-900">Quick Actions</h3>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Link href={`/coach/observations?centerId=${centerId}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    New Observation
                  </Link>
                  <Link href={`/coach/follow-ups?centerId=${centerId}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    New Follow-up
                  </Link>
                  <Link href="/coach/compliance" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    Compliance Check
                  </Link>
                  <Link href="/coach/messages" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    Message Teachers
                  </Link>
                </div>
              </div>

              {/* Recent Observations */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-gray-900">Recent Observations</h3>
                {recentObservations.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No observations yet.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {recentObservations.map((obs) => (
                      <div key={obs.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-gray-900">
                            {obs.teacher?.name || obs.teacher?.email}
                          </span>
                          <span className={[
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            obs.type === "CAMERA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700",
                          ].join(" ")}>
                            {obs.type === "CAMERA" ? "Camera" : "In-class"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {fmtDate(obs.date)}
                          {obs.classRoom ? ` — ${obs.classRoom.name}` : ""}
                          {obs.score != null ? ` — Score: ${obs.score}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </CoachLayout>
  );
}

function initials(name) {
  if (!name) return "T";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "T";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PriorityBadge({ priority }) {
  const cls = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-gray-100 text-gray-600",
  }[priority] || "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${cls}`}>
      {priority || "—"}
    </span>
  );
}

function PriorityDot({ priority }) {
  const cls = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
  }[priority] || "bg-gray-400";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-gray-500">{label}</div>
    </div>
  );
}
