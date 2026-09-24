/**
 * Builds the "Important Notices" feed for parents out of the three sources the
 * portal already has: center events, form submissions that need renewing, and
 * unread notifications.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatNoticeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function eventTone(type) {
  if (type === "HOLIDAY") return "rose";
  if (type === "FIELD_TRIP" || type === "SPECIAL_EVENT") return "emerald";
  if (type === "PARENT_MEETING") return "sky";
  return "sky";
}

function buildEventNotices(events, now, horizonDays) {
  const horizon = new Date(now.getTime() + horizonDays * DAY_MS);

  return (Array.isArray(events) ? events : [])
    .filter((event) => {
      const end = new Date(event.endDate || event.startDate);
      const start = new Date(event.startDate);
      if (Number.isNaN(start.getTime())) return false;
      return end >= new Date(now.getTime() - DAY_MS) && start <= horizon;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .map((event) => ({
      id: "event:" + event.id,
      kind: "event",
      tone: eventTone(event.type),
      title: event.title,
      detail: formatNoticeDate(event.startDate),
      href: "/parent/calendar",
      sortAt: new Date(event.startDate).getTime(),
    }));
}

function buildFormNotices(submissions, now) {
  const pending = (Array.isArray(submissions) ? submissions : [])
    .filter((submission) => submission?.expiresAt)
    .map((submission) => ({
      submission,
      expiresAt: new Date(submission.expiresAt),
    }))
    .filter((row) => !Number.isNaN(row.expiresAt.getTime()))
    .filter((row) => row.expiresAt.getTime() - now.getTime() < 45 * DAY_MS)
    .sort((a, b) => a.expiresAt - b.expiresAt);

  if (!pending.length) return [];

  const earliest = pending[0];
  const expired = earliest.expiresAt < now;
  const title =
    pending.length > 1
      ? "Please Complete Updated Forms"
      : earliest.submission.template?.title || "Form renewal";

  return [
    {
      id: "forms:" + earliest.submission.id,
      kind: "form",
      tone: expired ? "rose" : "amber",
      title,
      detail: expired
        ? "Expired " + formatShortDate(earliest.expiresAt)
        : "Due " + formatShortDate(earliest.expiresAt),
      href: "/parent/forms",
      sortAt: earliest.expiresAt.getTime(),
    },
  ];
}

function buildNotificationNotices(notifications, max) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter((notification) => !notification.read)
    .slice(0, max)
    .map((notification) => ({
      id: "notification:" + notification.id,
      kind: "info",
      tone: "amber",
      title: notification.title,
      detail: notification.body ? "Read More" : "",
      href: notification.link || "/parent/messages",
      sortAt: new Date(notification.createdAt).getTime(),
    }));
}

export function buildParentNotices({
  events = [],
  submissions = [],
  notifications = [],
  limit = 4,
  horizonDays = 60,
  now = new Date(),
} = {}) {
  const notices = [
    ...buildEventNotices(events, now, horizonDays),
    ...buildFormNotices(submissions, now),
    ...buildNotificationNotices(notifications, limit),
  ];

  // Events and form renewals lead (they are date-driven); notifications fill in.
  const dated = notices.filter((notice) => notice.kind !== "info");
  const info = notices.filter((notice) => notice.kind === "info");
  dated.sort((a, b) => a.sortAt - b.sortAt);
  info.sort((a, b) => b.sortAt - a.sortAt);

  return [...dated, ...info].slice(0, limit);
}
