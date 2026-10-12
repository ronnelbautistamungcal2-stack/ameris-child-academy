const OtherPagesIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
  </svg>
);

/**
 * Sidebars follow the client's navigation list (2026-10-02 requests). Existing
 * pages that list doesn't mention yet sit in this group until a later phase
 * gives them a home, such as a tab inside another page, so nothing that works
 * today becomes unreachable. Drop a page from here once it has that home.
 */
export function otherPagesGroup(children) {
  return { label: "Other Pages", icon: OtherPagesIcon, children };
}
