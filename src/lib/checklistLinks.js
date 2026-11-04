// Checklist items that link to the Log Activity page (client request
// 2026-10-02) or to the kitchen menu (client request 2026-10-29): the staff
// member has to open the link from the item before they can tick it. The link
// carries the item id so the page can record the visit.

const LOG_ACTIVITY_PATHS = ["/teacher/logs", "/coach/activity-overrides"];
const MENU_PATHS = ["/staff/kitchen/menus", "/admin/menus", "/parent/menus"];

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

export function isMenuLink(url) {
  return MENU_PATHS.includes(linkPath(url));
}

/** Links that must be opened from the item before it can be checked off. */
export function requiresLinkVisit(url) {
  return isLogActivityLink(url) || isMenuLink(url);
}

/** The href to open an item's link with; gated links carry the item id. */
export function checklistItemHref(item) {
  const url = String(item?.directLink || "").trim();
  if (!url || !item?.id || !requiresLinkVisit(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}checklistItem=${encodeURIComponent(item.id)}`;
}

export const LOG_FIRST_MESSAGE = "You must log this activity before checking off";
export const MENU_FIRST_MESSAGE = "You must open the menu before checking off";

export function linkFirstMessage(url) {
  return isMenuLink(url) ? MENU_FIRST_MESSAGE : LOG_FIRST_MESSAGE;
}
