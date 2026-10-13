import { useEffect } from "react";

/**
 * Keeps a page light even when this browser's app theme is dark: the kiosk and
 * printable reports. Restores dark mode when the page unmounts.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const strip = () => root.classList.contains("dark") && root.classList.remove("dark");
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      if (hadDark) root.classList.add("dark");
    };
  }, []);
}
