import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const UNASSIGNED_LABEL = "No Carpool Assigned";

function childFullName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

export default function CarpoolReport() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
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

  const carpoolGroups = useMemo(() => {
    const groups = new Map();
    for (const child of children) {
      const label = (child.carpool || "").trim() || UNASSIGNED_LABEL;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(child);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => childFullName(a).localeCompare(childFullName(b)));
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === UNASSIGNED_LABEL) return 1;
        if (b === UNASSIGNED_LABEL) return -1;
        return a.localeCompare(b);
      });
  }, [children]);

  const totalAssigned = children.length - (carpoolGroups.find(([label]) => label === UNASSIGNED_LABEL)?.[1].length || 0);
  const centerName = centers.find((c) => c.id === centerId)?.name || "";
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AdminLayout title="Carpool Report">
      <div className="space-y-4">
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Carpool Report</h2>
              <p className="mt-1 text-sm text-gray-600">
                A printable sheet grouping every child by carpool so pickup can be verified at a glance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!children.length}
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
          </div>

          {children.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              {totalAssigned} of {children.length} children have a carpool assigned, across {carpoolGroups.filter(([label]) => label !== UNASSIGNED_LABEL).length} carpool{carpoolGroups.filter(([label]) => label !== UNASSIGNED_LABEL).length === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        {error && (
          <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {!centerId ? (
          <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Select a center to view the carpool report.
          </div>
        ) : !children.length ? (
          <div className="no-print rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            No children found for this center.
          </div>
        ) : (
          <div id="carpool-report-print-sheet" className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-end justify-between border-b border-gray-200 pb-3">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Carpool Report</h1>
                <p className="text-sm text-gray-600">{centerName}</p>
              </div>
              <p className="text-xs text-gray-500">Generated {generatedOn}</p>
            </div>

            {carpoolGroups.map(([label, kids]) => (
              <div key={label} className="mb-6 break-inside-avoid">
                <h2 className="mb-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-extrabold text-gray-900">
                  {label} <span className="font-semibold text-gray-500">({kids.length})</span>
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 text-left">
                      <th className="px-2 py-2 font-extrabold text-gray-900">Child</th>
                      <th className="px-2 py-2 font-extrabold text-gray-900">Classroom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((child) => (
                      <tr key={child.id} className="border-b border-gray-200 align-top">
                        <td className="px-2 py-2 font-semibold text-gray-900">{childFullName(child)}</td>
                        <td className="px-2 py-2 text-gray-700">
                          {child.classRoomId ? classById[child.classRoomId]?.name || "—" : "Unassigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #carpool-report-print-sheet,
          #carpool-report-print-sheet * {
            visibility: visible;
          }
          #carpool-report-print-sheet {
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
