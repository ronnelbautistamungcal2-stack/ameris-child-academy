import AdminLayout from "@/components/admin/AdminLayout";
import MessageInbox from "@/components/messages/MessageInbox";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export default function AdminMessages() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers, {
    blankQueryValue: "all",
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
      } catch {
        setCenters([]);
      }
    })();
  }, []);

  return (
    <AdminLayout title="Messages">
      <MessageInbox
        centerId={centerId || undefined}
        isAdmin
        embedded
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="admin-message-center-filter" className="sr-only">
              Filter by center
            </label>
            <select
              id="admin-message-center-filter"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All centers</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            {centerId ? (
              <button
                type="button"
                onClick={() => setCenterId("")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm transition hover:bg-gray-50"
              >
                Clear
              </button>
            ) : null}
          </div>
        }
      />
    </AdminLayout>
  );
}
