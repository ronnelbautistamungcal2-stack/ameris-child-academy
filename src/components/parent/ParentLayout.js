import { useShellTitle } from "@/components/shell/PortalShell";

/**
 * The parent shell now lives in PortalShell (mounted once in _app.js), so this
 * only names the page. Kept as a component so parent pages read the same as the
 * rest of the app.
 */
export default function ParentLayout({ title, children }) {
  useShellTitle(title || "Parent");
  return <>{children}</>;
}
