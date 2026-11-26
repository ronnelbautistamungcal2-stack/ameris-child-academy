import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Parent Account Settings > Notification Settings (client sheet 10-29 (11),
// row 12): one row per notification with an on/off switch, like the mockup,
// and no Email / Text rows. These are the in-app notifications the portal
// sends; each switch saves right away.

const ROWS = [
  { type: "MESSAGE", label: "Messages" },
  { type: "ACTIVITY_UPDATE", label: "Activity Updates" },
  { type: "PROGRESS_UPDATE", label: "Progress Updates" },
  { type: "FORM_RENEWAL", label: "Form Renewals" },
  { type: "SYSTEM", label: "Account Updates" },
];

export default function NotificationPreferences() {
  const [enabled, setEnabled] = useState(null); // { TYPE: bool }
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/notifications/preferences")
      .then((rows) => {
        const map = Object.fromEntries(ROWS.map((r) => [r.type, true]));
        for (const row of Array.isArray(rows) ? rows : []) if (row.type in map) map[row.type] = Boolean(row.enabled);
        setEnabled(map);
      })
      .catch((e) => setError(e.message || "Failed to load your notification settings"));
  }, []);

  async function toggle(type) {
    const next = !enabled[type];
    setSaving(type);
    setError("");
    setEnabled((m) => ({ ...m, [type]: next }));
    try {
      await apiJson("/api/v1/notifications/preferences", { method: "PUT", body: JSON.stringify({ type, enabled: next }) });
    } catch (e) {
      setEnabled((m) => ({ ...m, [type]: !next }));
      setError(e.message || "Failed to save");
    } finally {
      setSaving("");
    }
  }

  if (error && !enabled) return <p className="text-sm text-red-700">{error}</p>;
  if (!enabled) return <p className="text-sm text-gray-500">Loading...</p>;
  return (
    <div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {ROWS.map((r) => {
          const on = enabled[r.type];
          return (
            <li key={r.type} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-bold text-[#0b2a5b] dark:text-blue-100">{r.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={r.label}
                disabled={saving === r.type}
                onClick={() => toggle(r.type)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"} disabled:opacity-60`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
