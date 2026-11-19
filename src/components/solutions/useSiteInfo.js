import { useEffect, useState } from "react";
import { SOLUTIONS_INFO } from "./siteInfo";

// The website's contact details with the phone and email from Global admin >
// Settings > General (client 2026-11-19), loaded once per page.

let cache = null;
let pending = null;

export default function useSiteInfo() {
  const [info, setInfo] = useState(cache);
  useEffect(() => {
    if (cache) return;
    pending ||= fetch("/api/v1/solutions/site-info")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    let alive = true;
    pending.then((data) => {
      if (data) cache = data;
      if (alive && data) setInfo(data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { ...SOLUTIONS_INFO, ...(info || {}) };
}
