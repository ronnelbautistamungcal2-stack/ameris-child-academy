import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useUserSocket, useNewMessages } from "@/hooks/useSocket";

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

function participantLabel(participants, myId) {
  const others = (participants || [])
    .filter((p) => p.userId !== myId)
    .map((p) => p.user?.name || p.user?.email || "User");
  return others.length > 0 ? others.join(", ") : "Conversation";
}

function roleBadgeColor(role) {
  const map = {
    ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    TEACHER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PARENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    COACH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return map[role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}

export default function MessageInbox({ centerId, isAdmin }) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(router.query.threadId || "");
  const [activeThread, setActiveThread] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // New conversation state
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef(null);
  const socket = useUserSocket(userId);

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

  // Open thread when navigating via notification link (?threadId=...)
  useEffect(() => {
    const qThread = router.query.threadId;
    if (qThread && qThread !== activeThreadId) {
      setActiveThreadId(qThread);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.threadId]);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveThread(null);
      return;
    }
    (async () => {
      try {
        const t = await apiJson(`/api/v1/messages/threads/${activeThreadId}`);
        setActiveThread(t);
      } catch (e) {
        setError(e.message || "Failed to load thread");
      }
    })();
  }, [activeThreadId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeThread?.messages]);

  // Real-time message updates
  useNewMessages(
    socket,
    useCallback(
      (msg) => {
        // Update thread list
        setThreads((prev) =>
          prev.map((t) =>
            t.id === msg.threadId
              ? { ...t, messages: [msg], updatedAt: new Date().toISOString(), unreadCount: (t.unreadCount || 0) + (msg.senderId !== userId ? 1 : 0) }
              : t,
          ),
        );
        // If viewing the same thread, append message
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
      // Refresh thread to get updated messages
      const t = await apiJson(`/api/v1/messages/threads/${activeThreadId}`);
      setActiveThread(t);
      refreshThreads();
    } catch (e2) {
      setError(e2.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  // User search for new conversation
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
      setShowCompose(false);
      setSelectedUsers([]);
      setNewTitle("");
      setNewMessage("");
      setSearchQuery("");
      await refreshThreads();
      setActiveThreadId(thread.id);
    } catch (e2) {
      setError(e2.message || "Failed to create conversation");
    } finally {
      setCreating(false);
    }
  }

  const preview = useMemo(() => {
    return (threads || []).map((t) => {
      const lastMsg = t.messages?.[0];
      return {
        id: t.id,
        title: t.title || participantLabel(t.participants, userId),
        last: lastMsg
          ? `${lastMsg.sender?.name || lastMsg.sender?.email || "User"}: ${String(lastMsg.body).slice(0, 120)}`
          : "No messages yet",
        time: t.updatedAt ? timeAgo(t.updatedAt) : "",
        unreadCount: t.unreadCount || 0,
        lastSenderRole: lastMsg?.sender?.role || null,
      };
    });
  }, [threads, userId]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Messages</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Send and receive messages with teachers, parents, admin, and coaches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-700"
        >
          New Conversation
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* New conversation modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-black/60" onClick={() => setShowCompose(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">New Conversation</h3>
            <form onSubmit={createThread} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Subject (optional)
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
                      {u.name || u.email}
                      <button
                        type="button"
                        onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
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
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Search by name or email..."
                />
                {searching && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (!selectedUsers.some((s) => s.id === u.id)) {
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
                        <span className={["rounded-full px-2 py-0.5 text-[10px] font-extrabold", roleBadgeColor(u.role)].join(" ")}>
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  rows={3}
                  placeholder="Type your message..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || selectedUsers.length === 0 || !newMessage.trim()}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Conversations
            </div>
            <button
              type="button"
              onClick={() => refreshThreads()}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-extrabold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
          ) : preview.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              No conversations yet. Start one!
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              {preview.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveThreadId(t.id)}
                  className={[
                    "w-full rounded-xl border px-3 py-2.5 text-left transition",
                    activeThreadId === t.id
                      ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/30"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          {t.title}
                        </span>
                        {t.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-extrabold text-white">
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-gray-600 dark:text-gray-400">
                        {t.last}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">{t.time}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation panel */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          {!activeThread ? (
            <div className="flex h-full items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
              Select a conversation to view messages
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                    {activeThread.title ||
                      participantLabel(activeThread.participants, userId)}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(activeThread.participants || []).map((p) => (
                      <span
                        key={p.userId}
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                          p.userId === userId
                            ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            : roleBadgeColor(p.user?.role),
                        ].join(" ")}
                      >
                        {p.userId === userId
                          ? "You"
                          : p.user?.name || p.user?.email}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="mt-3 max-h-[440px] space-y-3 overflow-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
                {(activeThread.messages || []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No messages yet
                  </div>
                ) : (
                  (activeThread.messages || []).map((m) => {
                    const isOwn = m.senderId === userId;
                    return (
                      <div
                        key={m.id}
                        className={["flex", isOwn ? "justify-end" : "justify-start"].join(" ")}
                      >
                        <div
                          className={[
                            "max-w-[75%] rounded-2xl px-4 py-2.5",
                            isOwn
                              ? "bg-sky-600 text-white"
                              : "border border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100",
                          ].join(" ")}
                        >
                          {!isOwn && (
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="text-xs font-extrabold">
                                {m.sender?.name || m.sender?.email}
                              </span>
                              <span
                                className={[
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                                  roleBadgeColor(m.sender?.role),
                                ].join(" ")}
                              >
                                {m.sender?.role}
                              </span>
                            </div>
                          )}
                          <p className="text-sm">{m.body}</p>
                          <p
                            className={[
                              "mt-1 text-[11px]",
                              isOwn ? "text-sky-200" : "text-gray-400",
                            ].join(" ")}
                          >
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <form onSubmit={send} className="mt-3 flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
