import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { MESSAGES_CHANGED_EVENT } from "@/components/shell/PortalShell";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/contexts/ToastContext";
import { useNewMessages, useUserSocket } from "@/hooks/useSocket";
import { apiJson } from "@/lib/api";

const NAVY = "text-[#12386a] dark:text-slate-100";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1765cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60";
const OUTLINE_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#1a73e8]/60 bg-white px-4 py-2 text-sm font-semibold text-[#1a73e8] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400/50 dark:bg-gray-800 dark:text-sky-300 dark:hover:bg-gray-700";
const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-sky-900/40";

const TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
];

const READ_FILTERS = [
  { id: "all", label: "All Messages" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "attachments", label: "With Attachments" },
];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Parents write to the center, never to other families.
const FAMILY_ROLES = new Set(["PARENT", "SUBSCRIBER"]);

function queryValue(value) {
  return typeof value === "string" ? value : "";
}

function personName(user) {
  return user?.name || user?.email || "Ameris Academy";
}

function initials(value) {
  const parts = String(value || "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAttachment(file) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("That file is too large. Please choose one under 25MB.");
  }
  const dataBase64 = await readFileAsBase64(file);
  const uploaded = await apiJson("/api/v1/uploads", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
  });
  return { url: uploaded.url, name: file.name, size: file.size, type: file.type || null };
}

function announceMessagesChanged() {
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}

function otherParticipants(thread, myId) {
  return (thread?.participants || []).filter((p) => p.userId !== myId);
}

/** Folders a conversation belongs to, from the viewer's side. */
function threadFolders(thread) {
  if (thread.archivedAt) return new Set(["archived"]);
  const total = thread._count?.messages ?? 0;
  const sent = thread.sentCount || 0;
  const folders = new Set();
  if (total - sent > 0) folders.add("inbox");
  if (sent > 0) folders.add("sent");
  return folders;
}

export default function ParentMessages() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const userId = session?.user?.id;
  const socket = useUserSocket(userId);
  const queryThreadId = queryValue(router.query.threadId);

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("inbox");
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState("all");
  const [activeId, setActiveId] = useState(queryThreadId);
  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(queryThreadId ? "thread" : "list");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [filing, setFiling] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSeed, setComposeSeed] = useState(null);

  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const refreshThreads = useCallback(async () => {
    try {
      const list = await apiJson("/api/v1/messages/threads");
      setThreads(Array.isArray(list) ? list : []);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  const loadThread = useCallback(async (threadId) => {
    if (!threadId) {
      setActiveThread(null);
      return;
    }
    setThreadLoading(true);
    try {
      const thread = await apiJson(`/api/v1/messages/threads/${threadId}`);
      if (activeIdRef.current !== threadId) return;
      setActiveThread(thread);
      setThreads((prev) =>
        prev.map((item) => (item.id === threadId ? { ...item, unreadCount: 0 } : item)),
      );
      announceMessagesChanged();
    } catch (e) {
      setError(e.message || "Failed to load conversation");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThread(activeId);
  }, [activeId, loadThread]);

  // Deep links from notifications (?threadId=) and the prefilled compose flow
  // used by billing and other parent pages (?compose=1&subject=&message=).
  useEffect(() => {
    if (!router.isReady) return;
    if (queryThreadId && queryThreadId !== activeIdRef.current) {
      setActiveId(queryThreadId);
      setMobilePanel("thread");
    }
  }, [router.isReady, queryThreadId]);

  useEffect(() => {
    if (!router.isReady || router.query.compose !== "1") return;
    const recipientId = queryValue(router.query.recipientId);
    setComposeSeed({
      subject: queryValue(router.query.subject),
      message: queryValue(router.query.message),
      recipient: recipientId
        ? {
            id: recipientId,
            name: queryValue(router.query.recipientName),
            email: queryValue(router.query.recipientEmail),
            role: queryValue(router.query.recipientRole),
          }
        : null,
    });
    setComposeOpen(true);
  }, [router.isReady, router.query.compose]);

  function replaceQuery(nextThreadId) {
    if (!router.isReady) return;
    const next = { ...router.query };
    ["compose", "subject", "message", "recipientId", "recipientName", "recipientEmail", "recipientRole"].forEach(
      (key) => delete next[key],
    );
    if (nextThreadId) next.threadId = nextThreadId;
    else delete next.threadId;
    void router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true });
  }

  useNewMessages(
    socket,
    useCallback(
      (msg) => {
        refreshThreads();
        if (msg?.threadId && msg.threadId === activeIdRef.current) {
          loadThread(msg.threadId);
        }
      },
      [loadThread, refreshThreads],
    ),
  );

  const rows = useMemo(
    () =>
      threads.map((thread) => {
        const others = otherParticipants(thread, userId);
        const counterpart = others[0]?.user || thread.createdBy;
        const last = thread.messages?.[0];
        const preview = last
          ? last.body || (last.attachmentName ? `Attachment: ${last.attachmentName}` : "")
          : "No messages yet";
        return {
          id: thread.id,
          thread,
          name: personName(counterpart),
          subject: thread.title || "(No subject)",
          preview,
          date: last?.createdAt || thread.updatedAt,
          unread: (thread.unreadCount || 0) > 0,
          hasAttachment: Boolean(last?.attachmentUrl),
          folders: threadFolders(thread),
        };
      }),
    [threads, userId],
  );

  const inboxUnread = useMemo(
    () => rows.filter((row) => row.folders.has("inbox") && row.unread).length,
    [rows],
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!row.folders.has(tab)) return false;
      if (readFilter === "unread" && !row.unread) return false;
      if (readFilter === "read" && row.unread) return false;
      if (readFilter === "attachments" && !row.hasAttachment) return false;
      if (!q) return true;
      return `${row.name} ${row.subject} ${row.preview}`.toLowerCase().includes(q);
    });
  }, [rows, tab, search, readFilter]);

  // Keep a conversation open: when the list changes and nothing (or something
  // no longer listed) is selected, fall back to the first visible one on wide
  // screens. A deep-linked thread stays selected even if it sits in another tab.
  useEffect(() => {
    if (loading) return;
    if (activeId && threads.some((thread) => thread.id === activeId)) return;
    if (activeId && activeId === queryThreadId) return;
    setActiveId(visibleRows[0]?.id || "");
  }, [loading, threads, visibleRows, activeId, queryThreadId]);

  function selectThread(threadId) {
    setActiveId(threadId);
    setMobilePanel("thread");
    replaceQuery(threadId);
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    const first = rows.find((row) => row.folders.has(nextTab));
    setActiveId(first?.id || "");
    replaceQuery("");
    setMobilePanel("list");
  }

  function selectNextAfter(threadId) {
    const index = visibleRows.findIndex((row) => row.id === threadId);
    const remaining = visibleRows.filter((row) => row.id !== threadId);
    const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
    setActiveId(next?.id || "");
    replaceQuery(next?.id || "");
    if (!next) setMobilePanel("list");
  }

  async function setArchived(threadId, archived) {
    setFiling(true);
    try {
      const result = await apiJson(`/api/v1/messages/threads/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      setThreads((prev) =>
        prev.map((item) =>
          item.id === threadId ? { ...item, archivedAt: result.archivedAt } : item,
        ),
      );
      selectNextAfter(threadId);
      announceMessagesChanged();
      toast.success(archived ? "Conversation archived." : "Conversation moved to your inbox.");
    } catch (e) {
      toast.error(e.message || "Could not update the conversation");
    } finally {
      setFiling(false);
    }
  }

  async function confirmDelete() {
    const threadId = pendingDelete;
    setPendingDelete(null);
    if (!threadId) return;
    setFiling(true);
    try {
      await apiJson(`/api/v1/messages/threads/${threadId}`, { method: "DELETE" });
      selectNextAfter(threadId);
      setThreads((prev) => prev.filter((item) => item.id !== threadId));
      announceMessagesChanged();
      toast.success("Conversation deleted.");
    } catch (e) {
      toast.error(e.message || "Could not delete the conversation");
    } finally {
      setFiling(false);
    }
  }

  async function handleCreated(thread) {
    setComposeOpen(false);
    setComposeSeed(null);
    await refreshThreads();
    if (thread?.id) {
      setTab("sent");
      setActiveId(thread.id);
      setMobilePanel("thread");
      replaceQuery(thread.id);
    }
    toast.success("Message sent.");
  }

  function closeCompose() {
    setComposeOpen(false);
    setComposeSeed(null);
    replaceQuery(activeId);
  }

  const suggestedContacts = useMemo(() => {
    const byId = new Map();
    threads.forEach((thread) =>
      otherParticipants(thread, userId).forEach((p) => {
        if (p.user && !FAMILY_ROLES.has(p.user.role) && !byId.has(p.user.id)) {
          byId.set(p.user.id, p.user);
        }
      }),
    );
    return [...byId.values()].slice(0, 6);
  }, [threads, userId]);

  const activeRow = rows.find((row) => row.id === activeId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className={`text-3xl font-black tracking-tight sm:text-4xl ${NAVY}`}>Messages</h1>
        <button type="button" className={PRIMARY_BUTTON} onClick={() => setComposeOpen(true)}>
          New Message
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Conversation list */}
        <section
          aria-label="Conversations"
          className={`flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
            mobilePanel === "thread" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="space-y-3 border-b border-gray-100 px-3 pt-2 pb-3 dark:border-gray-700">
            <div role="tablist" aria-label="Message folders" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
              {TABS.map((item) => {
                const selected = tab === item.id;
                const label =
                  item.id === "inbox" && inboxUnread > 0 ? `${item.label} (${inboxUnread})` : item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => changeTab(item.id)}
                    className={`-mb-px flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                      selected
                        ? "border-[#1a73e8] text-[#12386a] dark:border-sky-400 dark:text-sky-200"
                        : "border-transparent text-gray-500 hover:text-[#12386a] dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages..."
                aria-label="Search messages"
                className={`${FIELD} pl-9`}
              />
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              aria-label="Filter messages"
              className={FIELD}
            >
              {READ_FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700 lg:max-h-[calc(100vh-22rem)]">
            {loading ? (
              [0, 1, 2, 3].map((key) => (
                <li key={key} className="flex gap-3 px-4 py-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </li>
              ))
            ) : visibleRows.length === 0 ? (
              <li className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                {search || readFilter !== "all"
                  ? "No messages match your search."
                  : tab === "archived"
                    ? "Archived conversations will appear here."
                    : tab === "sent"
                      ? "Messages you send will appear here."
                      : "Your inbox is empty."}
              </li>
            ) : (
              visibleRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => selectThread(row.id)}
                    aria-current={row.id === activeId ? "true" : undefined}
                    className={`relative flex w-full items-start gap-3 py-3 pl-6 pr-4 text-left transition ${
                      row.id === activeId
                        ? "bg-sky-50 dark:bg-sky-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    {row.unread ? (
                      <span
                        className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#1a73e8]"
                        aria-label="Unread"
                      />
                    ) : null}
                    <Avatar label={row.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm font-bold ${NAVY}`}>{row.name}</span>
                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(row.date)}
                        </span>
                      </span>
                      <span
                        className={`block truncate text-sm ${
                          row.unread ? "font-bold" : "font-semibold"
                        } ${NAVY}`}
                      >
                        {row.subject}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {row.preview}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Reading pane */}
        <section
          aria-label="Conversation"
          className={`min-h-[32rem] rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
            mobilePanel === "list" ? "hidden lg:block" : "block"
          }`}
        >
          {activeThread && activeThread.id === activeId ? (
            <ThreadView
              thread={activeThread}
              userId={userId}
              archived={Boolean(activeRow?.thread.archivedAt)}
              filing={filing}
              onBack={() => setMobilePanel("list")}
              onArchive={() => setArchived(activeThread.id, !activeRow?.thread.archivedAt)}
              onDelete={() => setPendingDelete(activeThread.id)}
              onReplied={() => {
                loadThread(activeThread.id);
                refreshThreads();
              }}
            />
          ) : threadLoading || (loading && activeId) ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="flex h-full min-h-[32rem] flex-col items-center justify-center gap-2 p-8 text-center">
              <MailIcon className="h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className={`text-base font-bold ${NAVY}`}>No conversation selected</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose a message from the list, or start a new one.
              </p>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this conversation?"
        message="It will be removed from your messages. The center keeps its copy, and a new reply will bring the conversation back."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {composeOpen ? (
        <ComposeDialog
          seed={composeSeed}
          userId={userId}
          suggestedContacts={suggestedContacts}
          onClose={closeCompose}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}

function ThreadView({ thread, userId, archived, filing, onBack, onArchive, onDelete, onReplied }) {
  const toast = useToast();
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    setReply("");
    setAttachment(null);
  }, [thread.id]);

  useEffect(() => {
    if ((thread.messages || []).length > 1) {
      endRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [thread.messages]);

  const messages = thread.messages || [];
  const participants = thread.participants || [];

  function recipientsLabel(senderId) {
    const names = participants
      .filter((p) => p.userId !== senderId)
      .map((p) => (p.userId === userId ? "You" : personName(p.user)));
    return names.length ? names.join(", ") : "You";
  }

  async function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setAttachment(await uploadAttachment(file));
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    if (!reply.trim() && !attachment) return;
    setSending(true);
    try {
      await apiJson("/api/v1/messages/send", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          body: reply.trim(),
          attachment: attachment || undefined,
        }),
      });
      setReply("");
      setAttachment(null);
      onReplied();
    } catch (e) {
      toast.error(e.message || "Failed to send your reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#1a73e8] lg:hidden"
        >
          <span aria-hidden="true">&larr;</span> All messages
        </button>
        <div className="ml-auto flex items-center gap-2">
          <IconButton label={archived ? "Move to Inbox" : "Archive"} onClick={onArchive} disabled={filing}>
            {archived ? <InboxIcon className="h-4 w-4" /> : <ArchiveIcon className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Delete" onClick={onDelete} disabled={filing} danger>
            <TrashIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No messages in this conversation yet.</p>
        ) : null}
        {messages.map((msg, index) => (
          <article
            key={msg.id}
            className={index > 0 ? "border-t border-gray-200 pt-6 dark:border-gray-700" : ""}
          >
            <header className="flex items-start gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
              <Avatar label={personName(msg.sender)} large />
              <div className="min-w-0 flex-1">
                <p className={`font-bold ${NAVY}`}>
                  {msg.senderId === userId ? "You" : personName(msg.sender)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">To: {recipientsLabel(msg.senderId)}</p>
              </div>
              <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {formatDate(msg.createdAt)}
                <span className="ml-3">{formatTime(msg.createdAt)}</span>
              </p>
            </header>
            {index === 0 ? (
              <h2 className={`mt-4 text-xl font-bold ${NAVY}`}>{thread.title || "(No subject)"}</h2>
            ) : null}
            {msg.body ? (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200">
                {msg.body}
              </p>
            ) : null}
            {msg.attachmentUrl ? (
              <AttachmentCard
                url={msg.attachmentUrl}
                name={msg.attachmentName}
                size={msg.attachmentSize}
              />
            ) : null}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
        <label htmlFor="parent-reply" className={`mb-2 block text-sm font-bold ${NAVY}`}>
          Reply
        </label>
        <textarea
          id="parent-reply"
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type your message here..."
          className={`${FIELD} resize-y`}
        />
        {attachment ? (
          <PendingAttachment attachment={attachment} onRemove={() => setAttachment(null)} />
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <input ref={fileInputRef} type="file" className="hidden" onChange={pickFile} />
          <button
            type="button"
            className={OUTLINE_BUTTON}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <PaperclipIcon className="h-4 w-4" />
            {uploading ? "Uploading..." : "Attach File"}
          </button>
          <button
            type="submit"
            className={`${PRIMARY_BUTTON} min-w-[5.5rem]`}
            disabled={sending || uploading || (!reply.trim() && !attachment)}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ComposeDialog({ seed, userId, suggestedContacts, onClose, onCreated }) {
  const toast = useToast();
  const [recipient, setRecipient] = useState(seed?.recipient || null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState(seed?.subject || "");
  const [body, setBody] = useState(seed?.message || "");
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiJson(`/api/v1/users/search?q=${encodeURIComponent(q)}&limit=10`);
        setResults(
          (Array.isArray(data) ? data : []).filter(
            (u) => u.id !== userId && !FAMILY_ROLES.has(u.role),
          ),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userId]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setAttachment(await uploadAttachment(file));
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!recipient) {
      toast.error("Choose who to send this message to.");
      return;
    }
    if (!body.trim() && !attachment) return;
    setSending(true);
    try {
      const response = await apiJson("/api/v1/messages/threads", {
        method: "POST",
        body: JSON.stringify({
          participants: [{ id: recipient.id, role: recipient.role || undefined }],
          title: subject.trim() || undefined,
          firstMessage: body.trim(),
          attachment: attachment || undefined,
        }),
      });
      onCreated(response?.threads?.[0] || null);
    } catch (e) {
      toast.error(e.message || "Failed to send your message");
    } finally {
      setSending(false);
    }
  }

  const choices = query.trim().length >= 2 ? results : suggestedContacts;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-gray-900/50 dark:bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-message-title"
        className="relative z-10 w-full max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between">
          <h2 id="new-message-title" className={`text-xl font-bold ${NAVY}`}>
            New Message
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <span aria-hidden="true" className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <div>
          <label htmlFor="compose-to" className={`mb-1 block text-sm font-semibold ${NAVY}`}>
            To
          </label>
          {recipient ? (
            <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-800 dark:bg-sky-900/30">
              <span className="flex items-center gap-2 text-sm">
                <Avatar label={personName(recipient)} small />
                <span className={`font-semibold ${NAVY}`}>{personName(recipient)}</span>
              </span>
              <button
                type="button"
                onClick={() => setRecipient(null)}
                className="text-xs font-semibold text-[#1a73e8] hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                id="compose-to"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teachers and staff by name..."
                autoComplete="off"
                className={FIELD}
              />
              {choices.length > 0 || searching ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  {query.trim().length < 2 ? (
                    <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Recent contacts
                    </p>
                  ) : null}
                  {searching ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Searching...</p>
                  ) : (
                    choices.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setRecipient(person);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Avatar label={personName(person)} small />
                        <span className={`font-semibold ${NAVY}`}>{personName(person)}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : query.trim().length >= 2 ? (
                <p className="mt-2 text-xs text-gray-500">No staff members match that name.</p>
              ) : null}
            </>
          )}
        </div>

        <div>
          <label htmlFor="compose-subject" className={`mb-1 block text-sm font-semibold ${NAVY}`}>
            Subject
          </label>
          <input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What is this about?"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="compose-body" className={`mb-1 block text-sm font-semibold ${NAVY}`}>
            Message
          </label>
          <textarea
            id="compose-body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message here..."
            className={`${FIELD} resize-y`}
          />
          {attachment ? (
            <PendingAttachment attachment={attachment} onRemove={() => setAttachment(null)} />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <input ref={fileInputRef} type="file" className="hidden" onChange={pickFile} />
          <button
            type="button"
            className={OUTLINE_BUTTON}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <PaperclipIcon className="h-4 w-4" />
            {uploading ? "Uploading..." : "Attach File"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={PRIMARY_BUTTON}
              disabled={sending || uploading || !recipient || (!body.trim() && !attachment)}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AttachmentCard({ url, name, size }) {
  const isPdf = /\.pdf$/i.test(name || url);
  return (
    <a
      href={url}
      download={name || true}
      target="_blank"
      rel="noreferrer"
      className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
    >
      {isPdf ? <PdfIcon /> : <FileIcon className="h-7 w-7 text-gray-400" />}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${NAVY}`}>{name || "Attachment"}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{formatBytes(size)}</span>
      </span>
      <DownloadIcon className={`h-5 w-5 ${NAVY}`} />
      <span className="sr-only">Download</span>
    </a>
  );
}

function PendingAttachment({ attachment, onRemove }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/40">
      <span className="flex min-w-0 items-center gap-2">
        <PaperclipIcon className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="truncate text-gray-700 dark:text-gray-200">{attachment.name}</span>
        <span className="shrink-0 text-xs text-gray-500">{formatBytes(attachment.size)}</span>
      </span>
      <button type="button" onClick={onRemove} className="text-xs font-semibold text-red-600 hover:underline">
        Remove
      </button>
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30"
          : "border-gray-200 text-[#12386a] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function Avatar({ label, large, small }) {
  const size = large ? "h-11 w-11 text-sm" : small ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-[#12386a] dark:bg-slate-700 dark:text-slate-100 ${size}`}
    >
      {initials(label)}
    </span>
  );
}

function Svg({ className, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

function ArchiveIcon({ className }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </Svg>
  );
}

function InboxIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </Svg>
  );
}

function TrashIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </Svg>
  );
}

function PaperclipIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  );
}

function DownloadIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Svg>
  );
}

function FileIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </Svg>
  );
}

function MailIcon({ className }) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <path
        fill="#DC2626"
        d="M7 2.5h11.5L26 10v19a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 29V4a1.5 1.5 0 0 1 1-1.5Z"
      />
      <path fill="#FCA5A5" d="M18.5 2.5 26 10h-6a1.5 1.5 0 0 1-1.5-1.5Z" />
      <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Arial, sans-serif">
        PDF
      </text>
    </svg>
  );
}
