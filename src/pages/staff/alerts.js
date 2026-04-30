import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function byDateDesc(a, b) {
  const aTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return bTime - aTime;
}

export default function StaffAlerts() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/messages/threads");
        setThreads(Array.isArray(data) ? data : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const alerts = useMemo(() => {
    const rows = (threads || [])
      .slice()
      .sort(byDateDesc)
      .map((thread) => {
        const lastMessage = thread.messages?.[0] || null;
        const participants = thread.participants || [];
        const others = participants
          .filter((participant) => participant.user?.id !== lastMessage?.sender?.id)
          .map((participant) => participant.user?.name || participant.user?.email || "Staff");
        return {
          id: thread.id,
          title: thread.title || thread.center?.name || others.join(", ") || "Conversation",
          preview: lastMessage?.body || "No messages yet",
          updatedAt: thread.updatedAt || lastMessage?.createdAt || null,
          unreadCount: thread.unreadCount || 0,
          centerName: thread.center?.name || "No center",
          senderName: lastMessage?.sender?.name || lastMessage?.sender?.email || "Staff",
        };
      });

    if (!showUnreadOnly) return rows;
    return rows.filter((row) => row.unreadCount > 0);
  }, [showUnreadOnly, threads]);

  const unreadThreads = threads.filter((thread) => (thread.unreadCount || 0) > 0).length;
  const unreadMessages = threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);

  return (
    <StaffLayout title="Alerts">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Alerts</h2>
              <p className="mt-1 text-sm text-gray-600">
                Scan unread conversations, recent replies, and center-specific updates from one queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowUnreadOnly((current) => !current)}
                className={[
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  showUnreadOnly
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                {showUnreadOnly ? "Showing unread only" : "Show unread only"}
              </button>
              <Link
                href="/staff/messages"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
              >
                Open inbox
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <AlertStat label="Open threads" value={threads.length} tone="sky" />
            <AlertStat label="Unread threads" value={unreadThreads} tone="amber" />
            <AlertStat label="Unread messages" value={unreadMessages} tone="emerald" />
          </div>

          {loading ? (
            <div className="mt-5">
              <Skeleton count={4} />
            </div>
          ) : alerts.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No alerts match the current filter.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/staff/messages?threadId=${encodeURIComponent(alert.id)}`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-extrabold text-gray-900">{alert.title}</div>
                        {alert.unreadCount > 0 ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                            {alert.unreadCount} unread
                          </span>
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                            Caught up
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {alert.centerName}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">{alert.preview}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        Last reply from {alert.senderName}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {alert.updatedAt ? new Date(alert.updatedAt).toLocaleString() : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}

function AlertStat({ label, value, tone }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.sky}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}
