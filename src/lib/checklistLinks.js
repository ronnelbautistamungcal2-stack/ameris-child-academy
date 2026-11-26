// Checklist items that link to the Log Activity page (client request
// 2026-10-02) or to the kitchen menu (client request 2026-10-29): the staff
// member has to open the link from the item before they can tick it. The link
// carries the item id so the page can record the visit.

const LOG_ACTIVITY_PATHS = ["/teacher/logs", "/coach/activity-overrides"];
const MENU_PATHS = ["/staff/kitchen/menus", "/admin/menus", "/parent/menus"];
// My Classroom too (client sheet 10-29 (11), row 69).
const CLASSROOM_PATHS = ["/teacher/classroom"];

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

export function isClassroomLink(url) {
  return CLASSROOM_PATHS.includes(linkPath(url));
}

/** Links that must be opened from the item before it can be checked off. */
export function requiresLinkVisit(url) {
  return isLogActivityLink(url) || isMenuLink(url) || isClassroomLink(url);
}

/** The href to open an item's link with; gated links carry the item id. */
export function checklistItemHref(item) {
  const url = String(item?.directLink || "").trim();
  if (!url || !item?.id || !requiresLinkVisit(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}checklistItem=${encodeURIComponent(item.id)}`;
}

export const LOG_FIRST_MESSAGE = "You must log this activity before checking off";
export const MENU_FIRST_MESSAGE = "You must open the menu before checking off";
export const CLASSROOM_FIRST_MESSAGE = "You must open My Classroom before checking off";

export function linkFirstMessage(url) {
  if (isMenuLink(url)) return MENU_FIRST_MESSAGE;
  if (isClassroomLink(url)) return CLASSROOM_FIRST_MESSAGE;
  return LOG_FIRST_MESSAGE;
}
