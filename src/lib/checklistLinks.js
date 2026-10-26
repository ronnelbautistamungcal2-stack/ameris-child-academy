// Checklist items that link to the Log Activity page (client request
// 2026-10-02): the staff member has to open Log Activity from the item before
// they can tick it. The link carries the item id so the page can record the
// visit.

const LOG_ACTIVITY_PATHS = ["/teacher/logs", "/coach/activity-overrides"];

function linkPath(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, "http://local").pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function isLogActivityLink(url) {
  const path = linkPath(url);
  return LOG_ACTIVITY_PATHS.includes(path);
}

/** The href to open an item's link with; Log Activity links carry the item id. */
export function checklistItemHref(item) {
  const url = String(item?.directLink || "").trim();
  if (!url || !item?.id || !isLogActivityLink(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}checklistItem=${encodeURIComponent(item.id)}`;
}

export const LOG_FIRST_MESSAGE = "You must log this activity before checking off";
