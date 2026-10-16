import { apiJson } from "@/lib/api";
import { formatAge } from "@/lib/ageUtils";
import { useCallback, useEffect, useMemo, useState } from "react";

// Infant Feeding Plan (client request 2026-10-02): every infant's feeding
// plan on one printable sheet. Kitchen staff see it next to the menus; admins
// and coaches find it in Reports. It reads straight from the infants'
// profiles and reloads when the page regains focus, so profile edits show up
// without anyone regenerating it.

const REFRESH_MS = 60 * 1000;

function childFullName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

export default function InfantFeedingPlanReport() {
  const [centerId, setCenterId] = useState("");
  const [data, setData] = useState({ center: null, centers: [], classrooms: [], infants: [] });
  const [classRoomId, setClassRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (center, { quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const query = center ? `?centerId=${encodeURIComponent(center)}` : "";
      const next = await apiJson(`/api/v1/reports/infant-feeding-plan${query}`);
      setData(next);
      setError("");
      if (next.center && next.center.id !== center) setCenterId(next.center.id);
    } catch (e) {
      if (!quiet) setError(e.message || "Failed to load the feeding plans");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(centerId);
  }, [centerId, load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load(centerId, { quiet: true });
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [centerId, load]);

  const classById = useMemo(
    () => Object.fromEntries((data.classrooms || []).map((c) => [c.id, c])),
    [data.classrooms],
  );

  const infants = useMemo(
    () =>
      (data.infants || [])
        .filter((child) => !classRoomId || (child.classRoomId || "") === classRoomId)
        .sort((a, b) => {
          const classA = classById[a.classRoomId]?.name || "";
          const classB = classById[b.classRoomId]?.name || "";
          if (classA !== classB) return classA.localeCompare(classB);
          return childFullName(a).localeCompare(childFullName(b));
        }),
    [data.infants, classRoomId, classById],
  );

  const generatedOn = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const select = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-4">
      <div className="no-print rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold text-gray-900">Infant Feeding Plan</h2>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!infants.length}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {data.centers.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Center</span>
              <select
                value={centerId}
                onChange={(e) => {
                  setClassRoomId("");
                  setCenterId(e.target.value);
                }}
                disabled={loading}
                className={select}
              >
                {data.centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-gray-700">Classroom</span>
            <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} disabled={!data.center} className={select}>
              <option value="">All classrooms</option>
              {data.classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">Loading…</div>
      ) : !data.center ? (
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          You are not linked to a center yet.
        </div>
      ) : !infants.length ? (
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          No infants (0–11 months) found for this selection.
        </div>
      ) : (
        <div id="feeding-plan-print-sheet" className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-end justify-between border-b border-gray-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Infant Feeding Plan</h1>
              <p className="text-sm text-gray-600">{data.center.name}</p>
            </div>
            <p className="text-xs text-gray-500">Generated {generatedOn}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left">
                  {["Child", "Classroom", "Age", "Allergies", "What They Eat", "Formula", "# Bottles/Day", "Bottle Notes"].map((h) => (
                    <th key={h} className="px-2 py-2 font-extrabold text-gray-900">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {infants.map((child) => {
                  const plan = child.feedingPlan || {};
                  return (
                    <tr key={child.id} className="border-b border-gray-200 align-top">
                      <td className="px-2 py-2 font-semibold text-gray-900">{childFullName(child)}</td>
                      <td className="px-2 py-2 text-gray-700">
                        {child.classRoomId ? classById[child.classRoomId]?.name || "—" : "Unassigned"}
                      </td>
                      <td className="px-2 py-2 text-gray-700">{formatAge(child.birthDate) || "—"}</td>
                      <td className="px-2 py-2 text-gray-700">{child.allergies || "—"}</td>
                      <td className="px-2 py-2 text-gray-700">{plan.foods || "—"}</td>
                      <td className="px-2 py-2 text-gray-700">{plan.formula || "—"}</td>
                      <td className="px-2 py-2 text-gray-700">{plan.bottlesPerDay ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-700">{plan.bottleNotes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #feeding-plan-print-sheet,
          #feeding-plan-print-sheet * {
            visibility: visible;
          }
          #feeding-plan-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
