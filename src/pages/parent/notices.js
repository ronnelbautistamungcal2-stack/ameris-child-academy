import { useEffect, useMemo, useState } from "react";
import ParentLayout from "@/components/parent/ParentLayout";
import { ImportantNoticesCard } from "@/components/parent/ParentHomeCards";
import { ParentPageHeader } from "@/components/parent/ParentUI";
import { apiJson } from "@/lib/api";
import { buildParentNotices } from "@/lib/parentNotices";

export default function ParentNotices() {
  const [events, setEvents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [centers, formSubmissions, notificationPayload] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/forms/submissions").catch(() => []),
          apiJson("/api/v1/notifications?limit=25").catch(() => ({ notifications: [] })),
        ]);

        if (!cancelled) {
          setSubmissions(Array.isArray(formSubmissions) ? formSubmissions : []);
          setNotifications(
            Array.isArray(notificationPayload?.notifications)
              ? notificationPayload.notifications
              : [],
          );
        }

        const centerId = Array.isArray(centers) ? centers[0]?.id : "";
        if (!centerId) return;

        const from = new Date();
        from.setMonth(from.getMonth() - 1, 1);
        const to = new Date();
        to.setMonth(to.getMonth() + 6, 0);

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
        if (!cancelled) setError(e.message || "Failed to load notices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const notices = useMemo(
    () =>
      buildParentNotices({
        events,
        submissions,
        notifications,
        limit: 25,
        horizonDays: 180,
      }),
    [events, submissions, notifications],
  );

  return (
    <ParentLayout title="Notices">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family overview"
          title="Important Notices"
          description="Center events, forms that need renewing, and updates sent to your account."
          accent="amber"
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <ImportantNoticesCard notices={notices} loading={loading} actionHref="" />
      </div>
    </ParentLayout>
  );
}
