import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function ParentMessages() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function refreshThreads() {
    setLoading(true);
    setError("");
    try {
      const list = await apiJson("/api/v1/messages/threads");
      const arr = Array.isArray(list) ? list : [];
      setThreads(arr);
      if (!activeThreadId) setActiveThreadId(arr[0]?.id || "");
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const preview = useMemo(() => {
    return (threads || []).map((t) => ({
      id: t.id,
      title:
        t.title ||
        (t.center?.name ? `Center: ${t.center.name}` : "Conversation"),
      last:
        t.messages && t.messages[0]
          ? `${t.messages[0].sender?.email || "User"}: ${t.messages[0].body}`
          : "No messages yet",
    }));
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
      const t = await apiJson(`/api/v1/messages/threads/${activeThreadId}`);
      setActiveThread(t);
    } catch (e2) {
      setError(e2.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <ParentLayout title="Messages">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Messages</h2>
        <p className="mt-1 text-sm text-gray-600">
          Send and receive messages (basic threads + messages).
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Threads
            </div>
            {loading ? (
              <div className="mt-3 text-sm text-gray-600">Loading…</div>
            ) : preview.length === 0 ? (
              <div className="mt-3 text-sm text-gray-600">No threads yet.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {preview.map((t) => (
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
                    <div className="text-sm font-extrabold text-gray-900">
                      {t.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {t.last}
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
              <div className="mt-3 text-sm text-gray-600">
                Select a thread to view messages.
              </div>
            ) : (
              <>
                <div className="mt-2 max-h-[420px] space-y-2 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
                  {(activeThread.messages || []).map((m) => (
                    <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-3">
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
      </div>
    </ParentLayout>
  );
}
