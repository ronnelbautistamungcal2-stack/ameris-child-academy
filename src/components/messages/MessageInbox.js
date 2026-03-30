import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useUserSocket, useNewMessages } from "@/hooks/useSocket";
import { useToast } from "@/contexts/ToastContext";

const ADMIN_FILTERS = [
  { id: "all", label: "All" },
  { id: "parent", label: "Parents" },
  { id: "teacher", label: "Teachers" },
  { id: "coach", label: "Coaches" },
  { id: "group", label: "Groups" },
];

const COMPOSE_QUERY_KEYS = [
  "compose",
  "subject",
  "message",
  "recipientId",
  "recipientName",
  "recipientEmail",
  "recipientRole",
];

function queryList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || ""));
  if (typeof value === "string" && value) return [value];
  return [];
}

function seedRecipientsFromQuery(query) {
  const ids = queryList(query.recipientId);
  const names = queryList(query.recipientName);
  const emails = queryList(query.recipientEmail);
  const roles = queryList(query.recipientRole);

  return ids
    .map((id, index) => ({
      id,
      name: names[index] || "",
      email: emails[index] || "",
      role: roles[index] || "",
    }))
    .filter((recipient) => recipient.id);
}

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function participantLabel(participants, myId) {
  const others = (participants || [])
    .filter((p) => p.userId !== myId)
    .map((p) => p.user?.name || p.user?.email || "User");
  if (others.length === 0) return "Conversation";
  if (others.length <= 2) return others.join(", ");
  return `${others.slice(0, 2).join(", ")} +${others.length - 2}`;
}

function initialsFromLabel(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "CV";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function roleBadgeColor(role) {
  const map = {
    ADMIN:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    TEACHER:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PARENT:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    COACH:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return map[role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}

function matchesAdminFilter(thread, filterId) {
  if (filterId === "all") return true;
  if (filterId === "group") return thread.isGroup;
  return thread.participantRoles.includes(filterId.toUpperCase());
}

function summaryCardTone(tone) {
  const tones = {
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-100",
  };
  return tones[tone] || tones.sky;
}

export default function MessageInbox({ centerId, isAdmin }) {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const userId = session?.user?.id;

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(router.query.threadId || "");
  const [activeThread, setActiveThread] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [adminFilter, setAdminFilter] = useState("all");
  const [mobilePanel, setMobilePanel] = useState("list");

  const messagesEndRef = useRef(null);
  const socket = useUserSocket(userId);

  function resetComposeForm() {
    setSelectedUsers([]);
    setNewTitle("");
    setNewMessage("");
    setSearchQuery("");
    setSearchResults([]);
  }

  function clearComposeQuery() {
    if (!router.isReady) return;

    const nextQuery = { ...router.query };
    COMPOSE_QUERY_KEYS.forEach((key) => {
      delete nextQuery[key];
    });

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }

  function openCompose() {
    setShowCompose(true);
    setMobilePanel("list");
  }

  function startBlankCompose() {
    resetComposeForm();
    clearComposeQuery();
    openCompose();
  }

  function closeCompose() {
    setShowCompose(false);
    resetComposeForm();
    clearComposeQuery();
  }

  async function refreshThreads() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (centerId) params.set("centerId", centerId);
      if (isAdmin) params.set("all", "1");
      const list = await apiJson(`/api/v1/messages/threads?${params}`);
      const arr = Array.isArray(list) ? list : [];
      setThreads(arr);
      if (!activeThreadId && arr.length > 0) {
        const qThread = router.query.threadId;
        const match = qThread && arr.find((t) => t.id === qThread);
        setActiveThreadId(match ? match.id : arr[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  useEffect(() => {
    const qThread = router.query.threadId;
    if (qThread && qThread !== activeThreadId) {
      setActiveThreadId(qThread);
      setMobilePanel("thread");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.threadId]);

  useEffect(() => {
    if (router.query.compose !== "1") return;
    openCompose();
    setNewTitle(
      typeof router.query.subject === "string" ? router.query.subject : "",
    );
    setNewMessage(
      typeof router.query.message === "string" ? router.query.message : "",
    );
    setSelectedUsers(seedRecipientsFromQuery(router.query));
    setSearchQuery("");
    setSearchResults([]);
  }, [
    router.query.compose,
    router.query.message,
    router.query.recipientEmail,
    router.query.recipientId,
    router.query.recipientName,
    router.query.recipientRole,
    router.query.subject,
  ]);

  useEffect(() => {
    if (!router.isReady) return;
    const queryThreadId =
      typeof router.query.threadId === "string" ? router.query.threadId : "";
    if (queryThreadId === activeThreadId) return;

    const nextQuery = { ...router.query };
    if (activeThreadId) nextQuery.threadId = activeThreadId;
    else delete nextQuery.threadId;

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }, [activeThreadId, router]);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveThread(null);
      setMobilePanel("list");
      return;
    }
    (async () => {
      try {
        const thread = await apiJson(`/api/v1/messages/threads/${activeThreadId}`);
        setActiveThread(thread);
        setThreads((prev) =>
          prev.map((item) =>
            item.id === activeThreadId ? { ...item, unreadCount: 0 } : item,
          ),
        );
      } catch (e) {
        setError(e.message || "Failed to load thread");
      }
    })();
  }, [activeThreadId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeThread?.messages]);

  useNewMessages(
    socket,
    useCallback(
      (msg) => {
        setThreads((prev) =>
          prev.map((item) =>
            item.id === msg.threadId
              ? {
                  ...item,
                  messages: [msg],
                  updatedAt: new Date().toISOString(),
                  unreadCount:
                    (item.unreadCount || 0) + (msg.senderId !== userId ? 1 : 0),
                }
              : item,
          ),
        );
        if (msg.threadId === activeThreadId) {
          setActiveThread((prev) =>
            prev ? { ...prev, messages: [...(prev.messages || []), msg] } : prev,
          );
        }
      },
      [activeThreadId, userId],
    ),
  );

  async function send(e) {
    e.preventDefault();
    if (!activeThreadId || !message.trim()) return;
    setSending(true);
    setError("");
    try {
      await apiJson("/api/v1/messages/send", {
        method: "POST",
        body: JSON.stringify({ threadId: activeThreadId, body: message }),
      });
      setMessage("");
      const thread = await apiJson(`/api/v1/messages/threads/${activeThreadId}`);
      setActiveThread(thread);
      refreshThreads();
    } catch (e2) {
      const messageText = e2.message || "Failed to send message";
      setError(messageText);
      toast.error(messageText);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiJson(
          `/api/v1/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        );
        setSearchResults(Array.isArray(data) ? data.filter((u) => u.id !== userId) : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  async function createThread(e) {
    e.preventDefault();
    if (selectedUsers.length === 0 || !newMessage.trim()) return;
    setCreating(true);
    setError("");
    try {
      const thread = await apiJson("/api/v1/messages/threads", {
        method: "POST",
        body: JSON.stringify({
          participantIds: selectedUsers.map((u) => u.id),
          centerId: centerId || undefined,
          title: newTitle.trim() || undefined,
          firstMessage: newMessage,
        }),
      });
      closeCompose();
      await refreshThreads();
      setActiveThreadId(thread.id);
      setMobilePanel("thread");
      toast.success(
        selectedUsers.length > 1
          ? "Conversation created."
          : "Conversation started.",
      );
    } catch (e2) {
      const messageText = e2.message || "Failed to create conversation";
      setError(messageText);
      toast.error(messageText);
    } finally {
      setCreating(false);
    }
  }

  function selectThread(threadId) {
    setActiveThreadId(threadId);
    setMobilePanel("thread");
  }

  const preview = useMemo(
    () =>
      (threads || []).map((thread) => {
        const title = thread.title || participantLabel(thread.participants, userId);
        const others = (thread.participants || []).filter((p) => p.userId !== userId);
        const participantRoles = [
          ...new Set(others.map((p) => p.user?.role).filter(Boolean)),
        ];
        const participantNames = others.map(
          (p) => p.user?.name || p.user?.email || "User",
        );
        const lastMsg = thread.messages?.[0];
        const lastSenderName =
          lastMsg?.sender?.name || lastMsg?.sender?.email || "User";

        return {
          id: thread.id,
          title,
          avatar: initialsFromLabel(title),
          last: lastMsg
            ? `${lastSenderName}: ${String(lastMsg.body).slice(0, 140)}`
            : "No messages yet",
          time: thread.updatedAt ? timeAgo(thread.updatedAt) : "",
          unreadCount: thread.unreadCount || 0,
          lastSenderRole: lastMsg?.sender?.role || null,
          centerName: thread.center?.name || "",
          participantRoles,
          participantCount: (thread.participants || []).length,
          isGroup: (thread.participants || []).length > 2,
          searchText: [
            title,
            thread.center?.name || "",
            participantNames.join(" "),
            participantRoles.join(" "),
            lastSenderName,
            lastMsg?.body || "",
          ]
            .join(" ")
            .toLowerCase(),
        };
      }),
    [threads, userId],
  );

  const unreadTotal = useMemo(
    () => (threads || []).reduce((sum, thread) => sum + (thread.unreadCount || 0), 0),
    [threads],
  );

  const adminSummary = useMemo(() => {
    if (!isAdmin) return [];
    return [
      { label: "Open conversations", value: preview.length, tone: "sky" },
      {
        label: "Unread threads",
        value: preview.filter((thread) => thread.unreadCount > 0).length,
        tone: "amber",
      },
      {
        label: "Parent touchpoints",
        value: preview.filter((thread) => thread.participantRoles.includes("PARENT"))
          .length,
        tone: "emerald",
      },
      {
        label: "Group threads",
        value: preview.filter((thread) => thread.isGroup).length,
        tone: "violet",
      },
    ];
  }, [isAdmin, preview]);

  const adminFilterCounts = useMemo(() => {
    if (!isAdmin) return {};
    return ADMIN_FILTERS.reduce((acc, filter) => {
      acc[filter.id] = preview.filter((thread) =>
        matchesAdminFilter(thread, filter.id),
      ).length;
      return acc;
    }, {});
  }, [isAdmin, preview]);

  const filteredPreview = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    return preview.filter((thread) => {
      if (showUnreadOnly && !thread.unreadCount) return false;
      if (isAdmin && adminFilter !== "all" && !matchesAdminFilter(thread, adminFilter)) {
        return false;
      }
      if (!q) return true;
      return thread.searchText.includes(q);
    });
  }, [preview, threadQuery, showUnreadOnly, isAdmin, adminFilter]);

  const activeMeta = useMemo(() => {
    if (!activeThread) return null;
    const title = activeThread.title || participantLabel(activeThread.participants, userId);
    return {
      title,
      avatar: initialsFromLabel(title),
      centerName: activeThread.center?.name || "",
      participantCount: (activeThread.participants || []).length,
      isGroup: (activeThread.participants || []).length > 2,
    };
  }, [activeThread, userId]);

  const listEmptyMessage =
    showUnreadOnly || threadQuery.trim() || (isAdmin && adminFilter !== "all")
      ? "No conversations match the current filters."
      : centerId
        ? "No conversations in this center yet."
        : "No conversations found yet.";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_50%)]" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            {isAdmin ? "Admin inbox" : "Inbox"}
          </div>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            Messages
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            {isAdmin
              ? "Triage parent and staff conversations across your centers, spot unread threads fast, and jump into the right reply lane."
              : "Clear, fast conversations across teachers, parents, admins, and coaches."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {threads.length} threads
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {unreadTotal} unread
            </span>
            {isAdmin && centerId ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                Center scoped
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={startBlankCompose}
          className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600"
        >
          New Conversation
        </button>
      </div>

      {isAdmin ? (
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {adminSummary.map((item) => (
            <div
              key={item.label}
              className={["rounded-2xl border px-4 py-3", summaryCardTone(item.tone)].join(" ")}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-extrabold">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {showCompose ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm dark:bg-black/60"
          onClick={closeCompose}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  New Conversation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {isAdmin
                    ? "Start a new thread with parents or staff without leaving the admin inbox."
                    : "Start a new message thread."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCompose}
                className="rounded-full border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>

            {isAdmin && centerId ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200">
                New conversations from this view will be scoped to the selected center.
              </div>
            ) : null}

            <form onSubmit={createThread} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Subject (optional)
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g. Regarding attendance..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Recipients
                </label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                    >
                      <span className="max-w-[14rem] break-words">{u.name || u.email}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUsers((prev) => prev.filter((item) => item.id !== u.id))
                        }
                        className="text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-200"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Search by name or email..."
                />
                {searching ? (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                ) : null}
                {searchResults.length > 0 ? (
                  <div className="mt-1 max-h-48 overflow-auto rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (!selectedUsers.some((item) => item.id === u.id)) {
                            setSelectedUsers((prev) => [...prev, u]);
                          }
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {u.name || u.email}
                        </span>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                            roleBadgeColor(u.role),
                          ].join(" ")}
                        >
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  rows={3}
                  placeholder="Type your message..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCompose}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || selectedUsers.length === 0 || !newMessage.trim()}
                  className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanel("list")}
          className={[
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-bold transition",
            mobilePanel === "list" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-gray-200 bg-white text-gray-600",
          ].join(" ")}
        >
          Conversations
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel("thread")}
          disabled={!activeThread}
          className={[
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
            mobilePanel === "thread" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-gray-200 bg-white text-gray-600",
          ].join(" ")}
        >
          Current thread
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div
          className={[
            "rounded-3xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50",
            mobilePanel === "thread" ? "hidden lg:block" : "",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Conversations
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {filteredPreview.length} visible
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshThreads()}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-extrabold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={threadQuery}
              onChange={(e) => setThreadQuery(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder={isAdmin ? "Search names, centers, roles, or message text..." : "Search conversations..."}
            />
            <button
              type="button"
              onClick={() => setShowUnreadOnly((v) => !v)}
              className={[
                "w-full rounded-2xl border px-3 py-2 text-left text-xs font-semibold",
                showUnreadOnly ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
              ].join(" ")}
            >
              {showUnreadOnly ? "Showing unread threads only" : "Show all conversations"}
            </button>
          </div>

          {isAdmin ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {ADMIN_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setAdminFilter(filter.id)}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    adminFilter === filter.id
                      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  <span>{filter.label}</span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
                    {adminFilterCounts[filter.id] || 0}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
          ) : filteredPreview.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {listEmptyMessage}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {filteredPreview.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={[
                    "w-full rounded-2xl border px-3 py-3 text-left transition",
                    activeThreadId === thread.id
                      ? "border-sky-200 bg-white ring-2 ring-sky-100 dark:border-sky-800 dark:bg-gray-800 dark:ring-sky-900/40"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 text-sm font-extrabold text-sky-700 dark:from-sky-900/40 dark:to-cyan-900/30 dark:text-sky-200">
                      {thread.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isAdmin && thread.centerName ? (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                                {thread.centerName}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {thread.isGroup ? "Group" : "Direct"}
                            </span>
                            {thread.unreadCount > 0 ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                                {thread.unreadCount}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 line-clamp-2 break-words text-sm font-extrabold text-gray-900 dark:text-gray-100">
                            {thread.title}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-gray-400">{thread.time}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {thread.participantRoles.slice(0, 3).map((role) => (
                          <span
                            key={`${thread.id}-${role}`}
                            className={[
                              "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                              roleBadgeColor(role),
                            ].join(" ")}
                          >
                            {role}
                          </span>
                        ))}
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {thread.participantCount} participants
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 break-words text-xs leading-5 text-gray-600 dark:text-gray-400">
                        {thread.last}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={[
            "rounded-3xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800",
            mobilePanel === "list" ? "hidden lg:block" : "",
          ].join(" ")}
        >
          {!activeThread || !activeMeta ? (
            <div className="flex min-h-[540px] items-center justify-center py-16">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-extrabold text-gray-900 dark:text-gray-100">
                  Select a conversation
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {isAdmin
                    ? "Pick a thread from the left to review context, scan participants, and reply without losing your place."
                    : "Choose a conversation to view messages and send a reply."}
                </p>
                <button
                  type="button"
                  onClick={startBlankCompose}
                  className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200"
                >
                  Start a conversation
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 pb-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setMobilePanel("list")}
                  className="mb-3 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-500 lg:hidden"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 text-sm font-extrabold text-sky-700 dark:from-sky-900/40 dark:to-cyan-900/30 dark:text-sky-200">
                        {activeMeta.avatar}
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-extrabold text-gray-900 dark:text-gray-100">
                          {activeMeta.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {isAdmin && activeMeta.centerName ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                              {activeMeta.centerName}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {activeMeta.isGroup ? "Group conversation" : "Direct conversation"}
                          </span>
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {activeMeta.participantCount} participants
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                            Live updates
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(activeThread.participants || []).map((participant) => (
                        <span
                          key={participant.userId}
                          className={[
                            "max-w-full rounded-full px-2.5 py-1 text-[10px] font-extrabold",
                            participant.userId === userId
                              ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              : roleBadgeColor(participant.user?.role),
                          ].join(" ")}
                        >
                          <span className="break-words">
                            {participant.userId === userId
                              ? "You"
                              : participant.user?.name || participant.user?.email}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 max-h-[520px] space-y-3 overflow-auto rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/80 to-white p-3 scrollbar-hide dark:border-gray-700 dark:from-gray-900/40 dark:to-gray-800">
                {(activeThread.messages || []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No messages yet
                  </div>
                ) : (
                  (activeThread.messages || []).map((item) => {
                    const isOwn = item.senderId === userId;
                    return (
                      <div key={item.id} className={["flex", isOwn ? "justify-end" : "justify-start"].join(" ")}>
                        <div
                          className={[
                            "max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm",
                            isOwn
                              ? "bg-gradient-to-br from-sky-600 to-cyan-500 text-white"
                              : "border border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100",
                          ].join(" ")}
                        >
                          {!isOwn ? (
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="text-xs font-extrabold">
                                {item.sender?.name || item.sender?.email}
                              </span>
                              <span
                                className={[
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                                  roleBadgeColor(item.sender?.role),
                                ].join(" ")}
                              >
                                {item.sender?.role}
                              </span>
                            </div>
                          ) : null}
                          <p className="break-words whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                          <p className={["mt-1 text-[11px]", isOwn ? "text-sky-100" : "text-gray-400"].join(" ")}>
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={send} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[48px] w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Type a message..."
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
