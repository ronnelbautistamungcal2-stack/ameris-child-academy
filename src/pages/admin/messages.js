import AdminLayout from "@/components/admin/AdminLayout";
import MessageInbox from "@/components/messages/MessageInbox";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminMessages() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);

  useSyncedCenterId(centerId, setCenterId, centers, {
    blankQueryValue: "all",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
      } catch {
        setCenters([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedCenter = useMemo(
    () => centers.find((center) => center.id === centerId) || null,
    [centers, centerId],
  );

  return (
    <AdminLayout title="Messages">
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_42%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-700">
                  Communications
                </div>
                <h1 className="mt-3 text-2xl font-extrabold text-gray-900">
                  Admin messaging workspace
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Review parent and staff conversations by center, scan unread threads
                  faster, and keep escalation context in one place.
                </p>
              </div>

              <div className="grid min-w-[260px] grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                    Scope
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-gray-900">
                    {centerId ? "Single center" : "All centers"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {centerId
                      ? selectedCenter?.name || "Selected center"
                      : `${centers.length} centers connected`}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                    Workflow
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-gray-900">
                    Unread-first
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Use the inbox filters to surface replies and handoffs quickly.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_300px]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Quick scopes
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCenterId("")}
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-bold transition",
                      !centerId
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    All centers
                  </button>
                  {centers.map((center) => (
                    <button
                      key={center.id}
                      type="button"
                      onClick={() => setCenterId(center.id)}
                      className={[
                        "rounded-full border px-4 py-2 text-sm font-bold transition",
                        centerId === center.id
                          ? "border-sky-200 bg-sky-50 text-sky-800"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {center.name}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Center selector
                </div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">All centers</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {loading ? (
          <Skeleton count={4} />
        ) : (
          <MessageInbox centerId={centerId || undefined} isAdmin />
        )}
      </div>
    </AdminLayout>
  );
}
