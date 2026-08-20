import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useUserSocket, useNewMessages } from "@/hooks/useSocket";
import { useToast } from "@/contexts/ToastContext";
import {
  canReceiveAccommodation,
  canCompleteWorkflow,
  canMarkReadyForReview,
  canReopenWorkflow,
  getAvailableThreadTypesForRole,
  isAccommodationThread,
  isWorkflowThread,
  MESSAGE_PRIORITY_LEVELS,
  MESSAGE_WORKFLOW_STATUSES,
  supportsDueDate,
  supportsPriority,
  threadTypeLabel,
  workflowStatusLabel,
} from "@/lib/messageWorkflows";
import { roleLabel } from "@/lib/roles";

const ADMIN_FILTERS = [
  { id: "all", label: "All" },
  { id: "parent", label: "Parents" },
  { id: "teacher", label: "Teachers" },
  { id: "other_staff", label: "Other Staff" },
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
  const others = (participants || []).filter((p) => p.userId !== myId);
  if (others.length === 0) return "Conversation";
  const names = others.map((p) => {
    const base = p.user?.name || p.user?.email || "User";
    return p.asRole && p.asRole !== p.user?.role ? `${base} (as ${roleLabel(p.asRole)})` : base;
  });
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
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

function userRolesOf(u) {
  return Array.isArray(u?.roles) && u.roles.length ? u.roles : [u?.role].filter(Boolean);
}

function eligibleRolesFor(u, newThreadType) {
  const roles = userRolesOf(u);
  return isAccommodationThread(newThreadType)
    ? roles.filter((role) => canReceiveAccommodation(role))
    : roles;
}

function roleBadgeColor(role) {
  const map = {
    ADMIN:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    TEACHER:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    OTHER_STAFF:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
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

function formatMessageTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function conversationKindLabel(isGroup) {
  return isGroup ? "Group conversation" : "Direct conversation";
}

function formatDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function workflowStatusTone(status) {
  switch (String(status || "").toUpperCase()) {
    case "READY_FOR_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200";
    default:
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200";
  }
}

function messageTypeTone(type) {
  switch (String(type || "").toUpperCase()) {
    case "OPEN_POINT":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200";
    case "REQUEST":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-200";
    case "ACCOMMODATION":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200";
  }
}

export default function MessageInbox({ centerId, isAdmin, embedded = false, toolbar = null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const userId = session?.user?.id;
  const viewerRole = String(session?.user?.role || "").toUpperCase();
  const isParentView = viewerRole === "PARENT";
  const canUseAudienceShortcuts =
    viewerRole !== "PARENT" && viewerRole !== "SUBSCRIBER";
  const queryThreadId =
    typeof router.query.threadId === "string" ? router.query.threadId : "";

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(queryThreadId);
  const [activeThread, setActiveThread] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [audienceOptions, setAudienceOptions] = useState([]);
  const [selectedAudiences, setSelectedAudiences] = useState([]);
  const [newThreadType, setNewThreadType] = useState("MESSAGE");
  const [newPriority, setNewPriority] = useState("A");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [audiencesLoading, setAudiencesLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [adminFilter, setAdminFilter] = useState("all");
  const [messageTypeFilter, setMessageTypeFilter] = useState("ALL");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState("ALL");
  const [workflowActionNote, setWorkflowActionNote] = useState("");
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(queryThreadId ? "thread" : "list");

  const messagesViewportRef = useRef(null);
  const queryThreadIdRef = useRef(queryThreadId);
  const socket = useUserSocket(userId);

  useEffect(() => {
    queryThreadIdRef.current = queryThreadId;
  }, [queryThreadId]);

  function resetComposeForm() {
    setSelectedUsers([]);
    setSelectedAudiences([]);
    setNewThreadType("MESSAGE");
    setNewPriority("A");
    setNewDueDate("");
    setNewTitle("");
    setNewMessage("");
    setSearchQuery("");
    setSearchResults([]);
  }

  function clearComposeQuery() {
    if (!router.isReady) return;

    const nextQuery = { ...router.query };
    let hasComposeQuery = false;
    COMPOSE_QUERY_KEYS.forEach((key) => {
      if (key in nextQuery) hasComposeQuery = true;
      delete nextQuery[key];
    });

    if (!hasComposeQuery) return;

    void router.replace(
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

  function replaceThreadQuery(nextThreadId) {
    if (!router.isReady) return;

    const currentThreadId =
      typeof router.query.threadId === "string" ? router.query.threadId : "";
    const normalizedNextThreadId = String(nextThreadId || "");
    if (currentThreadId === normalizedNextThreadId) return;

    const nextQuery = { ...router.query };
    if (normalizedNextThreadId) nextQuery.threadId = normalizedNextThreadId;
    else delete nextQuery.threadId;

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }

  const refreshThreads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (centerId) params.set("centerId", centerId);
      if (isAdmin) params.set("all", "1");
      const list = await apiJson(`/api/v1/messages/threads?${params}`);
      const arr = Array.isArray(list) ? list : [];
      setThreads(arr);
      setActiveThreadId((currentThreadId) => {
        if (currentThreadId || arr.length === 0) return currentThreadId;
        const preferredThreadId = queryThreadIdRef.current;
        const match =
          preferredThreadId &&
          arr.find((thread) => thread.id === preferredThreadId);
        if (match) setMobilePanel("thread");
        return match ? match.id : arr[0].id;
      });
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [centerId, isAdmin]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    if (!router.isReady || !queryThreadId) return;
    if (queryThreadId !== activeThreadId) {
      setActiveThreadId(queryThreadId);
    }
    setMobilePanel("thread");
  }, [router.isReady, queryThreadId, activeThreadId]);

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
    if (!showCompose || !canUseAudienceShortcuts) {
      setAudienceOptions([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setAudiencesLoading(true);
      try {
        const params = new URLSearchParams();
        if (centerId) params.set("centerId", centerId);
        if (newThreadType) params.set("threadType", newThreadType);
        const data = await apiJson(
          `/api/v1/messages/audiences${params.toString() ? `?${params.toString()}` : ""}`,
        );
        if (cancelled) return;
        const nextOptions = Array.isArray(data) ? data : [];
        setAudienceOptions(nextOptions);
        setSelectedAudiences((prev) =>
          prev
            .map((selected) =>
              nextOptions.find((option) => option.key === selected.key) || null,
            )
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) setAudienceOptions([]);
      } finally {
        if (!cancelled) setAudiencesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUseAudienceShortcuts, centerId, newThreadType, showCompose]);

  useEffect(() => {
    if (!isAccommodationThread(newThreadType)) return;
    setSelectedUsers((prev) =>
      prev
        .filter((u) => eligibleRolesFor(u, newThreadType).length > 0)
        .map((u) =>
          canReceiveAccommodation(u.role)
            ? u
            : { ...u, role: eligibleRolesFor(u, newThreadType)[0] || u.role },
        ),
    );
    setSearchResults((prev) => prev.filter((u) => eligibleRolesFor(u, newThreadType).length > 0));
  }, [newThreadType]);

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
    if (messagesViewportRef.current) {
      messagesViewportRef.current.scrollTo({
        top: messagesViewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeThread?.messages]);

  useNewMessages(
    socket,
    useCallback(
      (msg) => {
        let foundThread = false;

        setThreads((prev) => {
          const next = [...prev];
          const index = next.findIndex((item) => item.id === msg.threadId);
          if (index === -1) return prev;

          foundThread = true;
          const current = next[index];
          const isActiveThread = msg.threadId === activeThreadId;
          const unreadCount =
            msg.senderId === userId || isActiveThread
              ? 0
              : (current.unreadCount || 0) + 1;

          next.splice(index, 1);
          next.unshift({
            ...current,
            messages: [msg],
            updatedAt: msg.createdAt || new Date().toISOString(),
            unreadCount,
          });

          return next;
        });

        if (!foundThread) {
          refreshThreads();
        }

        if (msg.threadId === activeThreadId) {
          setActiveThread((prev) => {
            if (!prev) return prev;
            if ((prev.messages || []).some((item) => item.id === msg.id)) return prev;
            return { ...prev, messages: [...(prev.messages || []), msg] };
          });

          if (msg.senderId !== userId) {
            apiJson(`/api/v1/messages/threads/${msg.threadId}`)
              .then((thread) => {
                setActiveThread(thread);
                setThreads((prev) =>
                  prev.map((item) =>
                    item.id === msg.threadId ? { ...item, unreadCount: 0 } : item,
                  ),
                );
              })
              .catch(() => null);
          }
        }
      },
      [activeThreadId, refreshThreads, userId],
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

  async function runWorkflowAction(action, { requireNote = false } = {}) {
    if (!activeThreadId) return;
    const note = workflowActionNote.trim();
    if (requireNote && !note) {
      const messageText = "Add a note before sending this item back.";
      setError(messageText);
      toast.error(messageText);
      return;
    }

    setWorkflowSaving(true);
    setError("");
    try {
      const thread = await apiJson(`/api/v1/messages/threads/${activeThreadId}`, {
        method: "PUT",
        body: JSON.stringify({
          action,
          note: note || undefined,
        }),
      });
      setActiveThread(thread);
      setWorkflowActionNote("");
      await refreshThreads();
      toast.success("Workflow updated.");
    } catch (e2) {
      const messageText = e2.message || "Failed to update workflow";
      setError(messageText);
      toast.error(messageText);
    } finally {
      setWorkflowSaving(false);
    }
  }

  const matchingAudiences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !canUseAudienceShortcuts) return [];
    return audienceOptions.filter((option) => {
      if (option.count === 0) return false;
      if (selectedAudiences.some((selected) => selected.key === option.key)) return false;
      const haystack = `${option.label} ${option.description || ""} all`.toLowerCase();
      return haystack.includes(q);
    });
  }, [audienceOptions, canUseAudienceShortcuts, searchQuery, selectedAudiences]);

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
        const nextResults = Array.isArray(data) ? data.filter((u) => u.id !== userId) : [];
        setSearchResults(
          nextResults.filter((u) => eligibleRolesFor(u, newThreadType).length > 0),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newThreadType, searchQuery, userId]);

  function addSelectedUser(entry) {
    setSelectedUsers((prev) =>
      prev.some((item) => item.id === entry.id) ? prev : [...prev, entry],
    );
    setSearchQuery("");
    setSearchResults([]);
  }

  async function createThread(e) {
    e.preventDefault();
    if (
      (selectedUsers.length === 0 && selectedAudiences.length === 0) ||
      !newMessage.trim()
    ) {
      return;
    }
    setCreating(true);
    setError("");
    try {
      const response = await apiJson("/api/v1/messages/threads", {
        method: "POST",
        body: JSON.stringify({
          participants: selectedUsers.map((u) => ({ id: u.id, role: u.role || undefined })),
          audienceKeys: selectedAudiences.map((audience) => audience.key),
          centerId: centerId || undefined,
          threadType: newThreadType,
          priority: supportsPriority(newThreadType) ? newPriority : undefined,
          dueDate: supportsDueDate(newThreadType) && newDueDate ? newDueDate : undefined,
          title: newTitle.trim() || undefined,
          firstMessage: newMessage,
        }),
      });
      const createdThreads = Array.isArray(response?.threads) ? response.threads : [];
      closeCompose();
      await refreshThreads();
      const primaryThread = createdThreads[0];
      if (primaryThread) {
        setActiveThreadId(primaryThread.id);
        replaceThreadQuery(primaryThread.id);
        setMobilePanel("thread");
      }
      toast.success(
        createdThreads.length > 1
          ? `Sent privately to ${createdThreads.length} people — each got their own conversation.`
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
    replaceThreadQuery(threadId);
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
          type: thread.type || "MESSAGE",
          status: thread.status || "OPEN",
          priority: thread.priority || null,
          dueDate: thread.dueDate || null,
          createdAt: thread.createdAt || null,
          completedAt: thread.completedAt || null,
          createdById: thread.createdById || null,
          createdByName:
            thread.createdBy?.name || thread.createdBy?.email || "Sender",
          participantRoles,
          participantCount: (thread.participants || []).length,
          isGroup: (thread.participants || []).length > 2,
          searchText: [
            title,
            thread.center?.name || "",
            participantNames.join(" "),
            participantRoles.join(" "),
            thread.type || "",
            thread.status || "",
            thread.priority || "",
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
      {
        label: "Open conversations",
        value: preview.length,
        detail: centerId ? "In this center" : "Across centers",
        tone: "sky",
      },
      {
        label: "Unread threads",
        value: preview.filter((thread) => thread.unreadCount > 0).length,
        detail: "Needs a follow-up",
        tone: "amber",
      },
      {
        label: "Parent touchpoints",
        value: preview.filter((thread) => thread.participantRoles.includes("PARENT"))
          .length,
        detail: "Parent participation",
        tone: "emerald",
      },
      {
        label: "Group threads",
        value: preview.filter((thread) => thread.isGroup).length,
        detail: "Multi-person conversations",
        tone: "violet",
      },
    ];
  }, [centerId, isAdmin, preview]);

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
      if (messageTypeFilter !== "ALL" && thread.type !== messageTypeFilter) return false;
      if (workflowStatusFilter !== "ALL") {
        if (!isWorkflowThread(thread.type)) return false;
        if (thread.status !== workflowStatusFilter) return false;
      }
      if (!q) return true;
      return thread.searchText.includes(q);
    });
  }, [preview, threadQuery, showUnreadOnly, isAdmin, adminFilter, messageTypeFilter, workflowStatusFilter]);

  const activeMeta = useMemo(() => {
    if (!activeThread) return null;
    const title = activeThread.title || participantLabel(activeThread.participants, userId);
    return {
      title,
      avatar: initialsFromLabel(title),
      centerName: activeThread.center?.name || "",
      participantCount: (activeThread.participants || []).length,
      isGroup: (activeThread.participants || []).length > 2,
      type: activeThread.type || "MESSAGE",
      status: activeThread.status || "OPEN",
      priority: activeThread.priority || null,
      dueDate: activeThread.dueDate || null,
      createdAt: activeThread.createdAt || null,
      completedAt: activeThread.completedAt || null,
      createdById: activeThread.createdById || null,
      createdByName:
        activeThread.createdBy?.name || activeThread.createdBy?.email || "Sender",
    };
  }, [activeThread, userId]);

  const activeMessages = activeThread?.messages || [];
  const canReadyCurrentThread = useMemo(
    () => (activeThread ? canMarkReadyForReview(activeThread, userId, isAdmin) : false),
    [activeThread, isAdmin, userId],
  );
  const canCompleteCurrentThread = useMemo(
    () => (activeThread ? canCompleteWorkflow(activeThread, userId, isAdmin) : false),
    [activeThread, isAdmin, userId],
  );
  const canReopenCurrentThread = useMemo(
    () => (activeThread ? canReopenWorkflow(activeThread, userId, isAdmin) : false),
    [activeThread, isAdmin, userId],
  );

  const activeLastMessage = useMemo(() => {
    if (activeMessages.length === 0) return null;
    return activeMessages[activeMessages.length - 1] || null;
  }, [activeMessages]);

  const visibleUnreadCount = useMemo(
    () =>
      filteredPreview.reduce(
        (sum, thread) => sum + (thread.unreadCount > 0 ? thread.unreadCount : 0),
        0,
      ),
    [filteredPreview],
  );

  const hasActiveFilters =
    showUnreadOnly ||
    Boolean(threadQuery.trim()) ||
    (isAdmin && adminFilter !== "all") ||
    messageTypeFilter !== "ALL" ||
    workflowStatusFilter !== "ALL";

  const inboxSummary = useMemo(() => {
    if (isAdmin) return adminSummary;
    return [
      {
        label: hasActiveFilters ? "Visible now" : "Inbox coverage",
        value: filteredPreview.length,
        detail: hasActiveFilters ? "Matches current filters" : "Accessible conversations",
        tone: "sky",
      },
      {
        label: "Unread replies",
        value: unreadTotal,
        detail: unreadTotal ? `${visibleUnreadCount} visible in the list` : "You are caught up",
        tone: "amber",
      },
      {
        label: activeMeta ? "Current thread" : "Ready to send",
        value: activeMeta ? (activeMeta.isGroup ? "Group" : "Direct") : "Stand by",
        detail: activeMeta
          ? `${activeMeta.participantCount} participants`
          : "Open a thread or start a new conversation",
        tone: "emerald",
      },
      {
        label: "Last activity",
        value: activeLastMessage ? timeAgo(activeLastMessage.createdAt) : "Waiting",
        detail: activeLastMessage
          ? formatMessageTimestamp(activeLastMessage.createdAt)
          : "New replies appear here live",
        tone: "violet",
      },
    ];
  }, [
    activeLastMessage,
    activeMeta,
    adminSummary,
    filteredPreview.length,
    hasActiveFilters,
    isAdmin,
    unreadTotal,
    visibleUnreadCount,
  ]);

  const replyAudienceLabel = activeMeta
    ? activeMeta.isGroup
      ? `${Math.max(activeMeta.participantCount - 1, 1)} recipients`
      : "1 recipient"
    : "";
  const showIntro = !embedded;
  const panelHeightClass = embedded
    ? "min-h-[34rem] md:h-[74dvh] xl:h-[78dvh] md:max-h-[56rem]"
    : "min-h-[32rem] md:h-[70dvh] md:max-h-[52rem]";
  const availableThreadTypes = useMemo(
    () => getAvailableThreadTypesForRole(viewerRole),
    [viewerRole],
  );
  const workflowPreview = useMemo(
    () => preview.filter((thread) => isWorkflowThread(thread.type)),
    [preview],
  );
  const workflowReportRows = useMemo(
    () => filteredPreview.filter((thread) => isWorkflowThread(thread.type)),
    [filteredPreview],
  );
  const workflowSummary = useMemo(
    () => ({
      open: workflowPreview.filter((thread) => thread.status === "OPEN").length,
      review: workflowPreview.filter((thread) => thread.status === "READY_FOR_REVIEW").length,
      completed: workflowPreview.filter((thread) => thread.status === "COMPLETED").length,
    }),
    [workflowPreview],
  );

  function resetThreadFilters() {
    setThreadQuery("");
    setShowUnreadOnly(false);
    setAdminFilter("all");
    setMessageTypeFilter("ALL");
    setWorkflowStatusFilter("ALL");
  }

  const listEmptyMessage =
    hasActiveFilters
      ? "No conversations match the current filters."
      : centerId
        ? "No conversations in this center yet."
        : "No conversations found yet.";
  const inboxBadgeLabel = isParentView ? "Family inbox" : "Inbox";
  const inboxTitle = isParentView
    ? "Stay close to the classroom conversation."
    : "Keep the classroom conversation moving.";
  const inboxDescription = isParentView
    ? "Teacher updates, family questions, and billing follow-through stay in one thread-aware workspace so you can reply without losing context."
    : "Parent updates, teacher follow-through, and quick staff replies stay in one thread-aware workspace so you can respond without losing context.";
  const workflowLabel = isParentView ? "Parent workflow" : "Teacher workflow";
  const workflowDescription = isParentView
    ? "Start a new question, billing request, or child update follow-up without leaving the parent portal."
    : "Start a new thread or jump straight into the current conversation.";
  const composeHelperText = isAdmin
    ? "Start a new thread with parents or staff without leaving the admin inbox."
    : isParentView
      ? "Start a new message to the center or follow up on a family question."
      : "Start a new message thread.";
  const tipCopy = activeMeta
    ? `Reply inside this ${conversationKindLabel(activeMeta.isGroup).toLowerCase()} so earlier context stays attached for everyone involved.`
    : isParentView
      ? "Use a short subject like billing, pickup, schedule change, or progress question so staff can triage your message quickly."
      : "Use direct threads for family-specific updates and keep subjects short so parents can scan them quickly.";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[2rem] border border-sky-100 bg-white/95 shadow-[0_24px_70px_-36px_rgba(14,165,233,0.5)] dark:border-gray-700 dark:bg-gray-800/95",
        embedded ? "p-4 sm:p-5" : "p-5 sm:p-6",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.10),transparent_28%)]" />

      {showIntro ? (
        isAdmin ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  Admin inbox
                </div>
                <h2 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                  Messages
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                  Triage parent and staff conversations across your centers, spot unread
                  threads fast, and jump into the right reply lane.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {threads.length} threads
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {unreadTotal} unread
                  </span>
                  {centerId ? (
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

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {inboxSummary.map((item) => (
                <div
                  key={item.label}
                  className={["rounded-2xl border px-4 py-3", summaryCardTone(item.tone)].join(" ")}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-extrabold">{item.value}</div>
                  {item.detail ? (
                    <div className="mt-1 text-xs opacity-80">{item.detail}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)] xl:items-start">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                {inboxBadgeLabel}
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                {inboxTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                {inboxDescription}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {threads.length} threads
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {unreadTotal} unread
                </span>
                {activeMeta ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {conversationKindLabel(activeMeta.isGroup)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[1.6rem] border border-sky-100 bg-white/80 p-4 shadow-sm dark:border-sky-900/40 dark:bg-gray-900/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                      {workflowLabel}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {workflowDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startBlankCompose}
                    className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600"
                  >
                    New Conversation
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {inboxSummary.map((item) => (
                  <div
                    key={item.label}
                    className={["rounded-[1.4rem] border px-4 py-3", summaryCardTone(item.tone)].join(" ")}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">
                      {item.label}
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">{item.value}</div>
                    {item.detail ? (
                      <div className="mt-1 text-xs opacity-80">{item.detail}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
        <div
          className={[
            "flex flex-wrap items-center gap-3",
            toolbar ? "justify-between" : "justify-end",
          ].join(" ")}
        >
          {toolbar ? <div className="min-w-0 flex-1">{toolbar}</div> : null}
          <button
            type="button"
            onClick={startBlankCompose}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600"
          >
            New Conversation
          </button>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {embedded && (isAdmin || viewerRole === "COACH") ? (
        <div className="mb-4 rounded-[1.6rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-sm dark:border-sky-900/40 dark:from-sky-950/20 dark:via-gray-800 dark:to-cyan-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                {isAdmin ? "Admin workflows" : "Coach workflows"}
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-gray-100">
                {isAdmin ? "Messages, requests, and follow-through" : "Messages and follow-through"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                Create direct messages, open points, requests, and accommodations with timestamps and workflow tracking inside each thread.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              <button
                type="button"
                onClick={startBlankCompose}
                className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600"
              >
                New Conversation
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className={["rounded-2xl border px-4 py-3", summaryCardTone("sky")].join(" ")}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">Workflow Items</div>
              <div className="mt-2 text-2xl font-extrabold">{workflowPreview.length}</div>
              <div className="mt-1 text-xs opacity-80">Open points, requests, accommodations</div>
            </div>
            <div className={["rounded-2xl border px-4 py-3", summaryCardTone("amber")].join(" ")}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">Open</div>
              <div className="mt-2 text-2xl font-extrabold">{workflowSummary.open}</div>
              <div className="mt-1 text-xs opacity-80">Still in progress</div>
            </div>
            <div className={["rounded-2xl border px-4 py-3", summaryCardTone("violet")].join(" ")}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">Ready For Review</div>
              <div className="mt-2 text-2xl font-extrabold">{workflowSummary.review}</div>
              <div className="mt-1 text-xs opacity-80">Waiting on sender review</div>
            </div>
            <div className={["rounded-2xl border px-4 py-3", summaryCardTone("emerald")].join(" ")}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">Completed</div>
              <div className="mt-2 text-2xl font-extrabold">{workflowSummary.completed}</div>
              <div className="mt-1 text-xs opacity-80">Closed workflow items</div>
            </div>
          </div>
          {isAdmin ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-800/80">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    Workflow report
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Filter current and past open points, requests, and accommodations by type and status.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={messageTypeFilter}
                    onChange={(event) => setMessageTypeFilter(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="ALL">All types</option>
                    {availableThreadTypes
                      .filter((item) => item.value !== "MESSAGE")
                      .map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                  <select
                    value={workflowStatusFilter}
                    onChange={(event) => setWorkflowStatusFilter(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="ALL">All statuses</option>
                    {MESSAGE_WORKFLOW_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 max-h-72 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Priority</th>
                      <th className="px-2 py-2">Due</th>
                      <th className="px-2 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {workflowReportRows.map((thread) => (
                      <tr key={`workflow-${thread.id}`}>
                        <td className="px-2 py-2">
                          <span className={["rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", messageTypeTone(thread.type)].join(" ")}>
                            {threadTypeLabel(thread.type)}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          {thread.title}
                        </td>
                        <td className="px-2 py-2">
                          <span className={["rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", workflowStatusTone(thread.status)].join(" ")}>
                            {workflowStatusLabel(thread.status)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{thread.priority || "—"}</td>
                        <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{thread.dueDate ? formatMessageTimestamp(thread.dueDate) : "—"}</td>
                        <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{thread.time || "—"}</td>
                      </tr>
                    ))}
                    {workflowReportRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          No workflow items match the current report filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : toolbar ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>{toolbar}</div>
          <button
            type="button"
            onClick={startBlankCompose}
            className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600"
          >
            New Conversation
          </button>
        </div>
      ) : null}

      {showCompose ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 backdrop-blur-sm dark:bg-black/60 sm:items-center"
          onClick={closeCompose}
        >
          <div
            className="my-8 max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  New Conversation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {composeHelperText}
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="block md:col-span-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Type
                  </span>
                  <select
                    value={newThreadType}
                    onChange={(event) => setNewThreadType(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {availableThreadTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {supportsPriority(newThreadType) ? (
                  <label className="block md:col-span-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Priority
                    </span>
                    <select
                      value={newPriority}
                      onChange={(event) => setNewPriority(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {MESSAGE_PRIORITY_LEVELS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {supportsDueDate(newThreadType) ? (
                  <label className="block md:col-span-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Due Date
                    </span>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(event) => setNewDueDate(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </label>
                ) : null}
              </div>

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
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {newThreadType === "MESSAGE"
                    ? "Standard thread with normal back-and-forth replies."
                    : newThreadType === "OPEN_POINT"
                      ? "Recipient marks it ready for review, then the sender can complete it or send it back with notes."
                      : newThreadType === "REQUEST"
                        ? "Recipient can reply if needed or mark it completed."
                        : "Accommodations can be sent by admins or coaches and stay reportable with timestamps."}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Quick audience
                </label>
                {canUseAudienceShortcuts ? (
                  <>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {audienceOptions.map((option) => {
                        const selected = selectedAudiences.some(
                          (audience) => audience.key === option.key,
                        );
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() =>
                              setSelectedAudiences((prev) =>
                                selected
                                  ? prev.filter((audience) => audience.key !== option.key)
                                  : [...prev, option],
                              )
                            }
                            disabled={option.count === 0}
                            className={[
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                              selected
                                ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                            ].join(" ")}
                          >
                            <span>{option.label}</span>
                            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
                              {option.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {audiencesLoading ? (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Loading audience options...
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {isAccommodationThread(newThreadType)
                        ? "Accommodation threads can only go to teachers or staff."
                        : "Each person in a role-based audience gets their own private conversation — no one sees anyone else's replies."}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Role-based audience shortcuts are not available for this account.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Recipients
                </label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedAudiences.map((audience) => (
                    <span
                      key={audience.key}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                    >
                      <span className="max-w-[16rem] break-words">
                        {audience.label} ({audience.count})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAudiences((prev) =>
                            prev.filter((item) => item.key !== audience.key),
                          )
                        }
                        className="text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-200"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                    >
                      <span className="max-w-[14rem] break-words">{u.name || u.email}</span>
                      {u.role ? (
                        <span
                          className={[
                            "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
                            roleBadgeColor(u.role),
                          ].join(" ")}
                        >
                          as {roleLabel(u.role)}
                        </span>
                      ) : null}
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
                  placeholder={
                    isAccommodationThread(newThreadType)
                      ? "Search teachers or staff by name or email..."
                      : canUseAudienceShortcuts
                        ? "Search by name/email, or type \"all teachers\", \"all parents\"..."
                        : "Search by name or email to add individuals..."
                  }
                />
                {searching ? (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                ) : null}
                {matchingAudiences.length > 0 || searchResults.length > 0 ? (
                  <div className="mt-1 max-h-48 overflow-auto rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                    {matchingAudiences.map((option) => (
                      <button
                        key={`audience-${option.key}`}
                        type="button"
                        onClick={() => {
                          setSelectedAudiences((prev) =>
                            prev.some((item) => item.key === option.key)
                              ? prev
                              : [...prev, option],
                          );
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="flex w-full items-center gap-2 border-b border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-600"
                      >
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          Broadcast
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {option.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {option.count} private conversation{option.count === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}
                    {searchResults.map((u) => {
                      const roles = eligibleRolesFor(u, newThreadType);
                      if (roles.length <= 1) {
                        const role = roles[0] || u.role;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => addSelectedUser({ ...u, role })}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {u.name || u.email}
                            </span>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                                roleBadgeColor(role),
                              ].join(" ")}
                            >
                              {role}
                            </span>
                          </button>
                        );
                      }
                      return (
                        <div key={u.id} className="border-b border-gray-200 px-3 py-2 dark:border-gray-600">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {u.name || u.email}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {roles.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => addSelectedUser({ ...u, role })}
                                className={[
                                  "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase transition hover:opacity-80",
                                  roleBadgeColor(role),
                                ].join(" ")}
                              >
                                Message as {roleLabel(role)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
                  disabled={
                    creating ||
                    (selectedUsers.length === 0 && selectedAudiences.length === 0) ||
                    !newMessage.trim()
                  }
                  className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className={`${showIntro ? "mt-5" : "mt-4"} flex gap-2 xl:hidden`}>
        <button
          type="button"
          onClick={() => setMobilePanel("list")}
          className={[
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-bold transition",
            mobilePanel === "list"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-gray-200 bg-white text-gray-600",
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
            mobilePanel === "thread"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-gray-200 bg-white text-gray-600",
          ].join(" ")}
        >
          Current thread
        </button>
      </div>

      <div
        className={[
          showIntro ? "mt-6" : "mt-3",
          embedded
            ? "grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]"
            : "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]",
        ].join(" ")}
      >
        <div
          className={[
            panelHeightClass,
            embedded
              ? "rounded-[1.5rem] border border-gray-200 bg-gray-50/90 p-3 dark:border-gray-700 dark:bg-gray-900/50"
              : "rounded-[1.8rem] border border-gray-200 bg-gray-50/90 p-4 dark:border-gray-700 dark:bg-gray-900/50",
            mobilePanel === "thread" ? "hidden xl:flex xl:flex-col" : "flex flex-col",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Conversations
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {filteredPreview.length}
                </span>
                {visibleUnreadCount > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 shadow-sm dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {visibleUnreadCount} unread
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshThreads()}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-extrabold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>

          <div className={`${embedded ? "mt-3" : "mt-4"} space-y-2`}>
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 14.5L18 18m-8.5-1a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
              </span>
              <input
                value={threadQuery}
                onChange={(e) => setThreadQuery(e.target.value)}
                className={[
                  "w-full border border-gray-200 bg-white pl-10 pr-10 text-sm shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40",
                  embedded ? "rounded-xl py-2.5" : "rounded-2xl py-3",
                ].join(" ")}
                placeholder={
                  isAdmin
                    ? "Search names, centers, roles, or message text..."
                    : "Search conversations..."
                }
              />
              {threadQuery ? (
                <button
                  type="button"
                  onClick={() => setThreadQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </button>
              ) : null}
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowUnreadOnly((value) => !value)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  showUnreadOnly
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                ].join(" ")}
              >
                {showUnreadOnly ? "Unread" : "All"}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetThreadFilters}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <div className={`${embedded ? "mt-3" : "mt-4"} flex flex-wrap gap-2`}>
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
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-[1.4rem] border border-gray-200 bg-white/80 animate-pulse dark:border-gray-700 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : filteredPreview.length === 0 ? (
            <div className={`${embedded ? "mt-4" : "mt-6"} rounded-[1.4rem] border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400`}>
              {listEmptyMessage}
            </div>
          ) : (
            <div className={`${embedded ? "mt-3" : "mt-4"} flex-1 space-y-2 overflow-auto pr-1`}>
              {filteredPreview.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={[
                    embedded
                      ? "w-full rounded-[1.15rem] border px-3 py-2.5 text-left transition duration-200"
                      : "w-full rounded-[1.4rem] border px-3 py-3 text-left transition duration-200",
                    activeThreadId === thread.id
                      ? "border-sky-200 bg-white shadow-[0_18px_40px_-28px_rgba(14,165,233,0.7)] ring-2 ring-sky-100 dark:border-sky-800 dark:bg-gray-800 dark:ring-sky-900/40"
                      : "border-gray-200 bg-white/95 hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        "flex shrink-0 items-center justify-center bg-gradient-to-br from-sky-100 to-cyan-100 text-sm font-extrabold text-sky-700 dark:from-sky-900/40 dark:to-cyan-900/30 dark:text-sky-200",
                        embedded ? "h-10 w-10 rounded-xl" : "h-11 w-11 rounded-2xl",
                      ].join(" ")}
                    >
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
                            <span className={["rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", messageTypeTone(thread.type)].join(" ")}>
                              {threadTypeLabel(thread.type)}
                            </span>
                            {isWorkflowThread(thread.type) ? (
                              <span className={["rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", workflowStatusTone(thread.status)].join(" ")}>
                                {workflowStatusLabel(thread.status)}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {thread.isGroup ? "Group" : "Direct"}
                            </span>
                            {thread.priority ? (
                              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                                Priority {thread.priority}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {thread.participantCount}
                            </span>
                            {thread.unreadCount > 0 ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                                {thread.unreadCount}
                              </span>
                            ) : null}
                          </div>
                          <div className={`${embedded ? "mt-0.5 line-clamp-1" : "mt-1 line-clamp-2"} break-words text-sm font-extrabold text-gray-900 dark:text-gray-100`}>
                            {thread.title}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-gray-400">{thread.time}</span>
                      </div>
                      {!embedded ? (
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
                      ) : null}
                      <div
                        className={[
                          embedded ? "mt-1 line-clamp-1" : "mt-2 line-clamp-2",
                          "break-words text-xs leading-5 text-gray-600 dark:text-gray-400",
                        ].join(" ")}
                      >
                        {thread.last}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isAdmin && !embedded ? (
            <div className="mt-3 rounded-[1.4rem] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 dark:border-sky-900/40 dark:from-sky-950/30 dark:to-gray-900">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                {activeMeta ? "Current focus" : "Teacher messaging tip"}
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {tipCopy}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                  Live updates
                </span>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {showUnreadOnly ? "Unread filter on" : "All conversations visible"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={[
            panelHeightClass,
            embedded
              ? "rounded-[1.5rem] border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
              : "rounded-[1.8rem] border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800",
            mobilePanel === "list" ? "hidden xl:flex xl:flex-col" : "flex flex-col",
          ].join(" ")}
        >
          {!activeThread || !activeMeta ? (
            <div className="flex flex-1 items-center justify-center py-16">
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
                    : "Choose a conversation to read the history and send a reply without losing classroom context."}
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
              <div className={`border-b border-gray-100 ${embedded ? "pb-3" : "pb-4"} dark:border-gray-700`}>
                <button
                  type="button"
                  onClick={() => setMobilePanel("list")}
                  className="mb-3 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-500 shadow-sm xl:hidden"
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

                <div className={`flex flex-col ${embedded ? "gap-3" : "gap-4"} xl:flex-row xl:items-start xl:justify-between`}>
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "flex shrink-0 items-center justify-center bg-gradient-to-br from-sky-100 to-cyan-100 text-sm font-extrabold text-sky-700 dark:from-sky-900/40 dark:to-cyan-900/30 dark:text-sky-200",
                          embedded ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-2xl",
                        ].join(" ")}
                      >
                        {activeMeta.avatar}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`${embedded ? "text-[15px]" : "text-base"} break-words font-extrabold text-gray-900 dark:text-gray-100`}>
                          {activeMeta.title}
                        </h3>
                        <div className={`${embedded ? "mt-1.5" : "mt-2"} flex flex-wrap gap-1.5`}>
                          {isAdmin && activeMeta.centerName ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                              {activeMeta.centerName}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {conversationKindLabel(activeMeta.isGroup)}
                          </span>
                          <span className={["rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide", messageTypeTone(activeMeta.type)].join(" ")}>
                            {threadTypeLabel(activeMeta.type)}
                          </span>
                          {isWorkflowThread(activeMeta.type) ? (
                            <span className={["rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide", workflowStatusTone(activeMeta.status)].join(" ")}>
                              {workflowStatusLabel(activeMeta.status)}
                            </span>
                          ) : null}
                          {activeMeta.priority ? (
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              Priority {activeMeta.priority}
                            </span>
                          ) : null}
                          {activeMeta.dueDate ? (
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              Due {formatMessageTimestamp(activeMeta.dueDate)}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {activeMeta.participantCount} participants
                          </span>
                          {!embedded ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                              Live updates
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className={`${embedded ? "mt-2" : "mt-3"} flex flex-wrap gap-1.5`}>
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

                  <div className={`${embedded ? "mt-1" : "mt-3"} flex flex-wrap gap-1.5 xl:max-w-[320px] xl:justify-end`}>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                      {activeMessages.length} messages
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                      {activeLastMessage ? timeAgo(activeLastMessage.createdAt) : "Waiting"}
                    </span>
                    {!embedded ? (
                      <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {activeLastMessage
                          ? formatMessageTimestamp(activeLastMessage.createdAt)
                          : "New messages appear live"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {isWorkflowThread(activeMeta.type) ? (
                <div className="mt-4 rounded-[1.4rem] border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                        Workflow actions
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {activeMeta.type === "OPEN_POINT"
                          ? activeMeta.status === "READY_FOR_REVIEW"
                            ? "This open point is waiting for the sender to complete it or send it back with notes."
                            : "Recipients can mark this open point ready for review when their work is complete."
                          : activeMeta.type === "REQUEST"
                            ? "Recipients can reply for clarification or mark this request completed."
                            : "Accommodations stay timestamped here so admins and coaches can track what is still open."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeMeta.createdAt ? (
                          <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            Created {formatMessageTimestamp(activeMeta.createdAt)}
                          </span>
                        ) : null}
                        {activeMeta.completedAt ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Completed {formatMessageTimestamp(activeMeta.completedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canReadyCurrentThread ? (
                        <button
                          type="button"
                          onClick={() => runWorkflowAction("READY_FOR_REVIEW")}
                          disabled={workflowSaving}
                          className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-600 disabled:opacity-60"
                        >
                          {workflowSaving ? "Saving..." : "Ready To Review"}
                        </button>
                      ) : null}
                      {canCompleteCurrentThread ? (
                        <button
                          type="button"
                          onClick={() => runWorkflowAction("COMPLETE")}
                          disabled={workflowSaving}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {workflowSaving ? "Saving..." : "Completed"}
                        </button>
                      ) : null}
                      {canReopenCurrentThread ? (
                        <button
                          type="button"
                          onClick={() => runWorkflowAction("REOPEN", { requireNote: true })}
                          disabled={workflowSaving}
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:bg-gray-800 dark:text-rose-300"
                        >
                          {workflowSaving ? "Saving..." : "Send Back With Note"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {canReopenCurrentThread ? (
                    <div className="mt-3">
                      <textarea
                        value={workflowActionNote}
                        onChange={(event) => setWorkflowActionNote(event.target.value)}
                        className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
                        rows={2}
                        placeholder="Add the note that should go back to the recipient..."
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-gray-200 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.10),transparent_34%),linear-gradient(to_bottom,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] dark:border-gray-700 dark:bg-[linear-gradient(to_bottom,rgba(17,24,39,0.96),rgba(31,41,55,0.96))]">
                <div className={`border-b border-white/70 ${embedded ? "px-3 py-2" : "px-4 py-3"} dark:border-gray-700`}>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Conversation timeline
                    </div>
                    {!embedded ? (
                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
                        {isAdmin
                          ? "Reply without leaving the current thread."
                          : "Reply in-thread so earlier context stays attached to the conversation."}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  ref={messagesViewportRef}
                  className={[
                    "flex-1 space-y-3 overflow-auto scrollbar-hide",
                    embedded ? "px-3 py-3" : "px-3 py-4 sm:px-4",
                  ].join(" ")}
                >
                  {activeMessages.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No messages yet
                    </div>
                  ) : (
                    activeMessages.map((item) => {
                      const isOwn = item.senderId === userId;
                      return (
                        <div
                          key={item.id}
                          className={["flex", isOwn ? "justify-end" : "justify-start"].join(" ")}
                        >
                          <div
                            className={[
                              "flex max-w-[85%] flex-col",
                              isOwn ? "items-end" : "items-start",
                            ].join(" ")}
                          >
                            {!isOwn ? (
                              <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1">
                                <span className="text-xs font-extrabold text-gray-700 dark:text-gray-200">
                                  {item.sender?.name || item.sender?.email}
                                </span>
                                {item.sender?.role ? (
                                  <span
                                    className={[
                                      "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                                      roleBadgeColor(item.sender?.role),
                                    ].join(" ")}
                                  >
                                    {item.sender.role}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mb-1 px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">
                                You
                              </div>
                            )}

                            <div
                              className={[
                                embedded ? "rounded-[1.2rem] px-3 py-2.5 shadow-sm" : "rounded-[1.4rem] px-4 py-3 shadow-sm",
                                isOwn
                                  ? "bg-gradient-to-br from-sky-600 to-cyan-500 text-white"
                                  : "border border-gray-200 bg-white/90 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100",
                              ].join(" ")}
                            >
                              <p className={`break-words whitespace-pre-wrap text-sm ${embedded ? "leading-5" : "leading-6"}`}>
                                {item.body}
                              </p>
                            </div>
                            <p
                              className={[
                                "mt-1 px-1 text-[11px]",
                                isOwn
                                  ? "text-sky-700/80 dark:text-sky-300"
                                  : "text-gray-400 dark:text-gray-500",
                              ].join(" ")}
                            >
                              {formatMessageTimestamp(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <form
                onSubmit={send}
                className={[
                  embedded ? "mt-3 rounded-[1.4rem] p-2.5" : "mt-4 rounded-[1.6rem] p-3",
                  "border border-sky-100 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                          {embedded ? "Reply" : "Reply in thread"}
                        </div>
                        {!embedded ? (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {isAdmin
                              ? "Send a response without leaving the current conversation."
                              : "Replies stay attached to the thread so everyone keeps the same context."}
                          </p>
                        ) : null}
                      </div>
                      {replyAudienceLabel ? (
                        <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-bold text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          To {replyAudienceLabel}
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={[
                        "w-full resize-none border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40",
                        embedded ? "min-h-[80px] rounded-xl" : "min-h-[96px] rounded-2xl",
                      ].join(" ")}
                      placeholder="Type a message..."
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className={[
                      "w-full bg-gradient-to-r from-sky-600 to-cyan-500 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto",
                      embedded ? "rounded-xl px-4 py-2.5 lg:min-w-[108px]" : "rounded-2xl px-5 py-3 lg:min-w-[132px]",
                    ].join(" ")}
                  >
                    {sending ? "Sending..." : embedded ? "Send" : "Send reply"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
