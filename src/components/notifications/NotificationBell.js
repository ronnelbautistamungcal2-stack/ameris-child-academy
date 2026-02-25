import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { apiJson } from "@/lib/api";
import { useUserSocket, useNotifications } from "@/hooks/useSocket";

/* ── Toast notification popup ── */
function NotificationToast({ notification, onClose, onClick }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icon = TYPE_ICONS[notification.type] || TYPE_ICONS.SYSTEM;
  const color = TYPE_COLORS[notification.type] || TYPE_COLORS.SYSTEM;

  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg transition-all animate-[slideIn_0.3s_ease-out] dark:border-gray-600 dark:bg-gray-800"
    >
      <div className={["mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", color].join(" ")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{notification.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">{notification.body}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </button>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_ICONS = {
  MESSAGE: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  COMPLIANCE_ALERT: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.42 0z" />
    </svg>
  ),
  ACTIVITY_UPDATE: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  PROGRESS_UPDATE: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  SYSTEM: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const TYPE_COLORS = {
  MESSAGE: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  COMPLIANCE_ALERT: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  ACTIVITY_UPDATE: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  PROGRESS_UPDATE: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  SYSTEM: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export default function NotificationBell({ userId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const dropdownRef = useRef(null);

  const socket = useUserSocket(userId);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson("/api/v1/notifications?limit=20");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId, fetchNotifications]);

  // Real-time notification updates
  useNotifications(
    socket,
    useCallback(
      (notification) => {
        setNotifications((prev) => [notification, ...prev].slice(0, 20));
        setUnreadCount((prev) => prev + 1);
        // Show toast popup
        setToasts((prev) => [...prev, { ...notification, _toastId: Date.now() + Math.random() }]);
      },
      [],
    ),
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    try {
      await apiJson("/api/v1/notifications", {
        method: "PATCH",
        body: JSON.stringify({ readAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }

  async function handleClick(notification) {
    if (!notification.read) {
      try {
        await apiJson(`/api/v1/notifications/${notification.id}`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    }
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  function dismissToast(toastId) {
    setToasts((prev) => prev.filter((t) => t._toastId !== toastId));
  }

  function handleToastClick(toast) {
    dismissToast(toast._toastId);
    if (toast.link) router.push(toast.link);
    else {
      setOpen(true);
      fetchNotifications();
    }
  }

  return (
    <>
      {/* Toast popup container — fixed top-right */}
      <div className="pointer-events-none fixed right-4 top-16 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <NotificationToast
            key={t._toastId}
            notification={t}
            onClose={() => dismissToast(t._toastId)}
            onClick={() => handleToastClick(t)}
          />
        ))}
      </div>

    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchNotifications();
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"
          />
          <path strokeLinecap="round" d="M9 17a3 3 0 006 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={[
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700",
                    !n.read ? "bg-sky-50/50 dark:bg-sky-900/20" : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      TYPE_COLORS[n.type] || TYPE_COLORS.SYSTEM,
                    ].join(" ")}
                  >
                    {TYPE_ICONS[n.type] || TYPE_ICONS.SYSTEM}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={[
                          "truncate text-sm",
                          !n.read ? "font-extrabold text-gray-900 dark:text-gray-100" : "font-semibold text-gray-700 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">{n.body}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
