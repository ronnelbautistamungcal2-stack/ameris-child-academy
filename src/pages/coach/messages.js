import { useEffect, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import MessageInbox from "@/components/messages/MessageInbox";
import { apiJson } from "@/lib/api";

export default function CoachMessages() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers, {
    blankQueryValue: "all",
  });

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
      } catch {
        setCenters([]);
      }
    })();
  }, []);

  const activeCenterName = centers.find((center) => center.id === centerId)?.name || "";

  return (
    <CoachLayout title="Messages">
      <MessageInbox
        centerId={centerId || undefined}
        embedded
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="coach-message-center-filter" className="sr-only">
              Filter by center
            </label>
            <select
              id="coach-message-center-filter"
              value={centerId}
              onChange={(event) => setCenterId(event.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
            >
              <option value="">All conversations</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            {activeCenterName ? (
              <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                {activeCenterName}
              </span>
            ) : null}
          </div>
        }
      />
    </CoachLayout>
  );
}
