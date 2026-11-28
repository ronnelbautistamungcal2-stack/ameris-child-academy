import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

// The "Center" filter on list pages (client sheet 10-29 (11), rows 23-29):
// "All centers" or one center, remembered in this browser per portal. Shown
// even with one center (client sheet 10-29 (12): with one center it looked
// missing).

function storageKey(pathname) {
  const portal = String(pathname || "/").split("/").filter(Boolean)[0] || "global";
  return `aca:centerFilter:${portal}`;
}

/** [centerId ("" = all centers), setCenterId] */
export function useCenterFilter() {
  const router = useRouter();
  const key = storageKey(router.pathname);
  const [centerId, setCenterIdState] = useState("");
  useEffect(() => {
    try {
      setCenterIdState(window.localStorage.getItem(key) || "");
    } catch {
      // Storage blocked: start with all centers.
    }
  }, [key]);
  const setCenterId = useCallback(
    (id) => {
      setCenterIdState(id || "");
      try {
        window.localStorage.setItem(key, id || "");
      } catch {
        // Not remembered.
      }
    },
    [key],
  );
  return [centerId, setCenterId];
}

/** The select. `centers`: [{ id, name }]. A remembered center that isn't in the list reads as all centers. */
export default function CenterFilter({ centers = [], value, onChange, style, className }) {
  const known = centers.some((c) => c.id === value);
  useEffect(() => {
    if (value && centers.length && !known) onChange("");
  }, [value, centers.length, known, onChange]);
  if (!centers.length) return null;
  return (
    <select aria-label="Center" value={known ? value : ""} onChange={(e) => onChange(e.target.value)} style={style} className={className}>
      <option value="">All centers</option>
      {centers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
