import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { ageInMonths, formatAge } from "@/lib/ageUtils";
import { useEffect, useMemo, useState } from "react";

function childFullName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

export default function FeedingPlansReport() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        setCenterId(arr.length === 1 ? arr[0].id : "");
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setClassRoomId("");
    if (!centerId) {
      setClasses([]);
      setChildren([]);
      return;
    }
    (async () => {
      try {
        const [cls, kids] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        setChildren(Array.isArray(kids) ? kids : []);
      } catch (e) {
        setError(e.message || "Failed to load children");
      }
    })();
  }, [centerId]);

  const classById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes],
  );

  const infants = useMemo(() => {
    return children
      .filter((child) => {
        const months = ageInMonths(child.birthDate);
        if (months === null || months >= 12) return false;
        if (classRoomId && (child.classRoomId || "") !== classRoomId) return false;
        return true;
      })
      .sort((a, b) => {
        const classA = classById[a.classRoomId]?.name || "";
        const classB = classById[b.classRoomId]?.name || "";
        if (classA !== classB) return classA.localeCompare(classB);
        return childFullName(a).localeCompare(childFullName(b));
      });
  }, [children, classRoomId, classById]);

  const centerName = centers.find((c) => c.id === centerId)?.name || "";
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AdminLayout title="Feeding Plans Report">
      <div className="space-y-4">
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Infant Feeding Plans</h2>
              <p className="mt-1 text-sm text-gray-600">
                A single printable sheet listing every infant&rsquo;s feeding plan &mdash; post it in the kitchen.
              </p>
            </div>
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
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Center</span>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Classroom</span>
              <select
                value={classRoomId}
                onChange={(e) => setClassRoomId(e.target.value)}
                disabled={!centerId}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">All classrooms</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {!centerId ? (
          <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Select a center to view infant feeding plans.
          </div>
        ) : !infants.length ? (
          <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            No infants (under 12 months) found for this selection.
          </div>
        ) : (
          <div id="feeding-plan-print-sheet" className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-end justify-between border-b border-gray-200 pb-3">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Infant Feeding Plans</h1>
                <p className="text-sm text-gray-600">{centerName}</p>
              </div>
              <p className="text-xs text-gray-500">Generated {generatedOn}</p>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left">
                  <th className="px-2 py-2 font-extrabold text-gray-900">Child</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">Classroom</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">Age</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">Allergies</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">What They Eat</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">Formula</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900"># Bottles/Day</th>
                  <th className="px-2 py-2 font-extrabold text-gray-900">Bottle Notes</th>
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
        )}
      </div>

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
    </AdminLayout>
  );
}
