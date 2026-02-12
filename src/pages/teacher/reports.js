import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function extractDailyGrade(activity) {
  const details = activity?.details && typeof activity.details === "object" ? activity.details : null;
  if (!details || details.kind !== "DAILY_GRADE") return null;
  const grade = details.grade;
  if (typeof grade === "number") return grade;
  if (typeof grade === "string" && grade.trim()) {
    const n = Number(grade);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default function TeacherReports() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");

  const [child, setChild] = useState(null);
  const [progress, setProgress] = useState([]);
  const [activities, setActivities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingChild, setLoadingChild] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setChildren([]);
        setChildId("");
        setChild(null);
        setProgress([]);
        setActivities([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`);
        const arr = Array.isArray(kids) ? kids : [];
        arr.sort((a, b) => byString(a.firstName, b.firstName));
        setChildren(arr);
        setChildId((cur) => cur || arr[0]?.id || "");
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    (async () => {
      if (!childId) {
        setChild(null);
        setProgress([]);
        setActivities([]);
        return;
      }
      setLoadingChild(true);
      setError("");
      try {
        const [c, p, a] = await Promise.all([
          apiJson(`/api/v1/children/${encodeURIComponent(childId)}`),
          apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`).catch(() => []),
          apiJson(`/api/v1/activities?childId=${encodeURIComponent(childId)}`).catch(() => []),
        ]);
        setChild(c || null);
        setProgress(Array.isArray(p) ? p : []);
        setActivities(Array.isArray(a) ? a : []);
      } catch (e) {
        setError(e.message || "Failed to load report data");
      } finally {
        setLoadingChild(false);
      }
    })();
  }, [childId]);

  const activeGoals = useMemo(() => {
    return (progress || [])
      .filter((p) => ["NOT_STARTED", "IN_PROGRESS"].includes(p?.status))
      .slice()
      .sort((a, b) => {
        const cmp = byString(a?.lesson?.title, b?.lesson?.title);
        if (cmp !== 0) return cmp;
        return Number(a?.goalIndex || 0) - Number(b?.goalIndex || 0);
      })
      .slice(0, 8);
  }, [progress]);

  const recentActivities = useMemo(() => {
    return (activities || []).slice(0, 10);
  }, [activities]);

  const recentGrades = useMemo(() => {
    const grades = [];
    for (const a of activities || []) {
      const g = extractDailyGrade(a);
      if (g === null) continue;
      grades.push({ id: a.id, grade: g, createdAt: a.createdAt, notes: a.notes || null });
      if (grades.length >= 8) break;
    }
    return grades;
  }, [activities]);

  return (
    <TeacherLayout title="Reports">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 print:border-0 print:p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Reports</h2>
              <p className="mt-1 text-sm text-gray-600">
                Parent-teacher conference report (goals, grades, and notes).
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-1 w-64 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a center…</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Child
                </div>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="mt-1 w-64 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={!centerId || loading || loadingChild}
                >
                  <option value="">Select a child…</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50"
                disabled={!childId}
              >
                Print
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden">
              {error}
            </div>
          ) : null}

          {!centerId ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 print:hidden">
              Select a center.
            </div>
          ) : loadingChild ? (
            <div className="mt-4 text-sm text-gray-600 print:hidden">Loading…</div>
          ) : !child ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 print:hidden">
              Select a child to generate a report.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Child
                </div>
                <div className="mt-2 text-2xl font-extrabold text-gray-900">
                  {fullName(child)}
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  DOB: {formatDate(child.birthDate)} • Classroom: {child.classRoomId || "—"}
                </div>
                {child.allergies ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <span className="font-extrabold">Allergies:</span> {child.allergies}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Active goals
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Not started or in progress (up to 8).
                  </p>
                  {activeGoals.length ? (
                    <div className="mt-3 space-y-2">
                      {activeGoals.map((p) => (
                        <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {p.lesson?.title || "Lesson"}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            Step {p.goalIndex || 1} • {p.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No active goals found.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Child daily grade
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Recent grades logged from the Activity Logger.
                  </p>
                  {recentGrades.length ? (
                    <div className="mt-3 space-y-2">
                      {recentGrades.map((g) => (
                        <div key={g.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold text-gray-900">
                              Grade: {g.grade}
                            </div>
                            <div className="text-xs text-gray-500">{formatTime(g.createdAt)}</div>
                          </div>
                          {g.notes ? (
                            <div className="mt-1 text-xs text-gray-600">{g.notes}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No grades logged yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recent activity notes
                </div>
                <p className="mt-1 text-sm text-gray-600">Last 10 logs.</p>
                {recentActivities.length ? (
                  <div className="mt-3 space-y-2">
                    {recentActivities.map((a) => (
                      <div key={a.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {a.type}
                          </div>
                          <div className="text-xs text-gray-500">{formatTime(a.createdAt)}</div>
                        </div>
                        {a.notes ? (
                          <div className="mt-1 text-sm text-gray-800">{a.notes}</div>
                        ) : (
                          <div className="mt-1 text-sm text-gray-600">—</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No activity logs found.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 print:hidden">
                Next: add “Parent teacher conference report” export to PDF and include behavior/IEP flags once those fields are modeled.
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

