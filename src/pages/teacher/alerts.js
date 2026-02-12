import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

export default function TeacherAlerts() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function refreshThreads() {
    setLoading(true);
    setError("");
    try {
      const list = await apiJson("/api/v1/messages/threads");
      const arr = Array.isArray(list) ? list : [];
      setThreads(arr);
      setActiveThreadId((cur) => cur || arr[0]?.id || "");
    } catch (e) {
      setError(e.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshThreads();
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveThread(null);
      return;
    }
    (async () => {
      try {
        const t = await apiJson(`/api/v1/messages/threads/${encodeURIComponent(activeThreadId)}`);
        setActiveThread(t);
      } catch (e) {
        setError(e.message || "Failed to load conversation");
      }
    })();
  }, [activeThreadId]);

  const threadPreview = useMemo(() => {
    const rows = (threads || []).map((t) => {
      const last = t?.messages && t.messages[0] ? t.messages[0] : null;
      const title = t?.title || t?.center?.name || "Conversation";
      const lastLine = last
        ? `${last.sender?.email || "User"}: ${String(last.body || "").slice(0, 120)}`
        : "No messages yet";
      return {
        id: t.id,
        title,
        centerName: t?.center?.name || null,
        lastLine,
        lastSenderRole: last?.sender?.role || null,
        updatedAt: t?.updatedAt || null,
      };
    });

    return rows.sort((a, b) => byString(a.title, b.title));
  }, [threads]);

  const newParentMessagesCount = useMemo(() => {
    let count = 0;
    for (const t of threads || []) {
      const last = t?.messages && t.messages[0] ? t.messages[0] : null;
      if (last?.sender?.role === "PARENT") count += 1;
    }
    return count;
  }, [threads]);

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
      await refreshThreads();
      const t = await apiJson(`/api/v1/messages/threads/${encodeURIComponent(activeThreadId)}`);
      setActiveThread(t);
    } catch (e2) {
      setError(e2.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <TeacherLayout title="Alerts">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Alerts</h2>
            <p className="mt-1 text-sm text-gray-600">
              Parent messages and teacher notifications.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            New parent message threads: {newParentMessagesCount}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Messages
              </div>
              <button
                type="button"
                onClick={() => refreshThreads()}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-3 text-sm text-gray-600">Loading…</div>
            ) : threadPreview.length === 0 ? (
              <div className="mt-3 text-sm text-gray-600">No threads yet.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {threadPreview.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveThreadId(t.id)}
                    className={[
                      "w-full rounded-xl border px-3 py-2 text-left",
                      activeThreadId === t.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900">
                          {t.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                          {t.lastLine}
                        </div>
                        {t.centerName ? (
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {t.centerName}
                          </div>
                        ) : null}
                      </div>
                      {t.lastSenderRole === "PARENT" ? (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-900">
                          Parent
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Conversation
            </div>
            {!activeThread ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                Select a thread to view messages.
              </div>
            ) : (
              <>
                <div className="mt-2 max-h-[440px] space-y-2 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
                  {(activeThread.messages || []).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-600">
                          {m.sender?.email || "User"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-gray-900">{m.body}</div>
                    </div>
                  ))}
                  {(activeThread.messages || []).length === 0 ? (
                    <div className="text-sm text-gray-600">No messages yet.</div>
                  ) : null}
                </div>

                <form onSubmit={send} className="mt-3 flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Type a message…"
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Tip: For classroom-wide announcements, create a new thread with the admin (or request an admin to add the right participants).
        </div>
      </div>
    </TeacherLayout>
  );
}

