import { userRoles } from "@/lib/roles";

export const MESSAGE_THREAD_TYPES = [
  { value: "MESSAGE", label: "Message" },
  { value: "OPEN_POINT", label: "Open Point" },
  { value: "REQUEST", label: "Request" },
  { value: "ACCOMMODATION", label: "Accommodation" },
];

export const MESSAGE_WORKFLOW_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "READY_FOR_REVIEW", label: "Ready For Review" },
  { value: "COMPLETED", label: "Completed" },
];

export const MESSAGE_PRIORITY_LEVELS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

export function threadTypeLabel(value) {
  return (
    MESSAGE_THREAD_TYPES.find((item) => item.value === String(value || "").toUpperCase())?.label ||
    "Message"
  );
}

export function workflowStatusLabel(value) {
  return (
    MESSAGE_WORKFLOW_STATUSES.find((item) => item.value === String(value || "").toUpperCase())
      ?.label || "Open"
  );
}

export function isWorkflowThread(type) {
  return ["OPEN_POINT", "REQUEST", "ACCOMMODATION"].includes(
    String(type || "").toUpperCase(),
  );
}

export function isAccommodationThread(type) {
  return String(type || "").toUpperCase() === "ACCOMMODATION";
}

export function canConfigureWorkflowThread(type) {
  return isWorkflowThread(type);
}

export function supportsPriority(type) {
  return ["OPEN_POINT", "REQUEST"].includes(String(type || "").toUpperCase());
}

export function supportsDueDate(type) {
  return String(type || "").toUpperCase() === "OPEN_POINT";
}

export function canSendAccommodation(role) {
  return ["ADMIN", "COACH"].includes(String(role || "").toUpperCase());
}

export function canReceiveAccommodation(role) {
  return ["TEACHER", "OTHER_STAFF"].includes(String(role || "").toUpperCase());
}

/**
 * Picks the role a multi-role recipient is being addressed as in a given thread.
 * Honors an explicit, valid requestedRole; otherwise falls back to a role that
 * qualifies for the thread type (accommodations must land on teacher/staff), or
 * the recipient's first held role.
 */
export function resolveMessageRecipientRole({ user, requestedRole, threadType }) {
  const heldRoles = userRoles(user);
  const normalizedRequested = requestedRole ? String(requestedRole).trim().toUpperCase() : null;
  if (normalizedRequested && heldRoles.includes(normalizedRequested)) {
    return normalizedRequested;
  }
  if (isAccommodationThread(threadType)) {
    return heldRoles.find((role) => canReceiveAccommodation(role)) || heldRoles[0] || null;
  }
  return heldRoles[0] || null;
}

export function getAvailableThreadTypesForRole(role) {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "ADMIN") return MESSAGE_THREAD_TYPES;
  if (normalizedRole === "COACH") return MESSAGE_THREAD_TYPES;
  if (normalizedRole === "TEACHER" || normalizedRole === "OTHER_STAFF") {
    return MESSAGE_THREAD_TYPES.filter((item) =>
      ["MESSAGE", "REQUEST"].includes(item.value),
    );
  }
  return MESSAGE_THREAD_TYPES.filter((item) => item.value === "MESSAGE");
}

export function canMarkReadyForReview(thread, userId, isAdmin = false) {
  const type = String(thread?.type || "").toUpperCase();
  return (
    type === "OPEN_POINT" &&
    thread?.status === "OPEN" &&
    (isAdmin || (userId && userId !== thread?.createdById))
  );
}

export function canCompleteWorkflow(thread, userId, isAdmin = false) {
  const type = String(thread?.type || "").toUpperCase();
  if (!isWorkflowThread(type)) return false;
  if (type === "REQUEST") {
    return thread?.status !== "COMPLETED" && (isAdmin || (userId && userId !== thread?.createdById));
  }
  if (type === "OPEN_POINT") {
    return thread?.status === "READY_FOR_REVIEW" && (isAdmin || userId === thread?.createdById);
  }
  if (type === "ACCOMMODATION") {
    return thread?.status !== "COMPLETED" && (isAdmin || userId === thread?.createdById);
  }
  return false;
}

export function canReopenWorkflow(thread, userId, isAdmin = false) {
  const type = String(thread?.type || "").toUpperCase();
  if (!isWorkflowThread(type)) return false;
  if (type === "OPEN_POINT") {
    return (
      thread?.status === "READY_FOR_REVIEW" &&
      (isAdmin || userId === thread?.createdById)
    );
  }
  return thread?.status === "COMPLETED" && (isAdmin || userId === thread?.createdById);
}

export function normalizeThreadType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return MESSAGE_THREAD_TYPES.some((item) => item.value === normalized) ? normalized : "MESSAGE";
}

export function normalizeWorkflowStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return MESSAGE_WORKFLOW_STATUSES.some((item) => item.value === normalized) ? normalized : "OPEN";
}

export function normalizePriorityLevel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return MESSAGE_PRIORITY_LEVELS.some((item) => item.value === normalized) ? normalized : null;
}
