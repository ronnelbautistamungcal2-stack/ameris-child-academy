import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ParentLayout from "@/components/parent/ParentLayout";
import { CalendarCard } from "@/components/parent/ParentHomeCards";
import { ParentEmpty, ParentPageHeader, ParentSection } from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatNoticeDate } from "@/lib/parentNotices";

export default function ParentCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const centers = await apiJson("/api/v1/centers");
        const centerId = Array.isArray(centers) ? centers[0]?.id : "";
        if (!centerId) {
          if (!cancelled) setEvents([]);
          return;
        }

        const from = new Date();
        from.setMonth(from.getMonth() - 6, 1);
        const to = new Date();
        to.setMonth(to.getMonth() + 12, 0);

        const list = await apiJson(
          "/api/v1/events?centerId=" +
            encodeURIComponent(centerId) +
            "&from=" +
            from.toISOString() +
            "&to=" +
            to.toISOString(),
        );
        if (!cancelled) setEvents(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load the calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter((event) => new Date(event.endDate || event.startDate) >= now)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 12);
  }, [events]);

  return (
    <ParentLayout title="Calendar">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family overview"
          title="Calendar"
          description="Center holidays, closures, field trips, and family events."
          accent="sky"
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <CalendarCard events={events} actionHref="" compact={false} />

          <ParentSection
            title="Upcoming"
            description="The next events on the center calendar."
          >
            {loading ? (
              <Skeleton count={4} />
            ) : upcoming.length === 0 ? (
              <ParentEmpty
                title="Nothing scheduled yet"
                description="When the center publishes events they will show up here and on your dashboard."
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {upcoming.map((event) => (
                  <li key={event.id} className="py-3">
                    <div className="text-sm font-bold text-[#12386a] dark:text-slate-100">
                      {event.title}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                      {formatNoticeDate(event.startDate)}
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {event.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ParentSection>
        </div>

        <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
          Need something added?{" "}
          <Link href="/parent/messages" className="font-semibold text-sky-600 hover:text-sky-700">
            Message the center
          </Link>
          .
        </p>
      </div>
    </ParentLayout>
  );
}
