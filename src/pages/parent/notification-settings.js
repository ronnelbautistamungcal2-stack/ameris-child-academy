import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

const TYPE_LABELS = {
  MESSAGE: {
    label: "Messages",
    description: "Get notified when you receive a new message",
  },
  ACTIVITY_UPDATE: {
    label: "Activity Updates",
    description: "Get notified when a teacher logs an activity for your child",
  },
  PROGRESS_UPDATE: {
    label: "Progress Updates",
    description: "Get notified when progress is recorded for your child",
  },
  SYSTEM: {
    label: "System Announcements",
    description: "Important system updates and announcements",
  },
};

const PARENT_TYPES = ["MESSAGE", "ACTIVITY_UPDATE", "PROGRESS_UPDATE", "SYSTEM"];

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function fetchPreferences() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson("/api/v1/notifications/preferences");
      setPreferences(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function togglePreference(type, currentEnabled) {
    setSaving(type);
    setError("");
    try {
      await apiJson("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ type, enabled: !currentEnabled }),
      });
      setPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: !currentEnabled } : p)),
      );
    } catch (e) {
      setError(e.message || "Failed to save preference");
    } finally {
      setSaving("");
    }
  }

  const visiblePrefs = preferences.filter((p) => PARENT_TYPES.includes(p.type));

  return (
    <ParentLayout title="Notification Settings">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">
          Notification Preferences
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Choose which notifications you want to receive.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-gray-600">Loading preferences...</div>
        ) : (
          <div className="mt-6 divide-y divide-gray-100">
            {visiblePrefs.map((pref) => {
              const info = TYPE_LABELS[pref.type];
              if (!info) return null;
              const isSaving = saving === pref.type;

              return (
                <div
                  key={pref.type}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">
                      {info.label}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {info.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreference(pref.type, pref.enabled)}
                    disabled={isSaving}
                    className={[
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                      pref.enabled ? "bg-sky-600" : "bg-gray-200",
                      isSaving ? "opacity-50" : "",
                    ].join(" ")}
                    role="switch"
                    aria-checked={pref.enabled}
                  >
                    <span
                      className={[
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
                        pref.enabled ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Changes are saved automatically. Disabled notifications will not appear
          in your notification bell.
        </div>
      </div>
    </ParentLayout>
  );
}
