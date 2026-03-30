import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentPageHeader,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TYPE_LABELS = {
  MESSAGE: {
    label: "Messages",
    description: "Get notified when you receive a new message from the center.",
  },
  ACTIVITY_UPDATE: {
    label: "Activity updates",
    description: "See new logs, updates, and daily activity notes for your child.",
  },
  PROGRESS_UPDATE: {
    label: "Progress updates",
    description: "Get notified when teachers record developmental progress.",
  },
  SYSTEM: {
    label: "System announcements",
    description: "Important portal updates and service-wide reminders.",
  },
  FORM_RENEWAL: {
    label: "Form renewals",
    description: "See reminders when enrollment or medical forms are close to expiring.",
  },
};

const PARENT_TYPES = ["MESSAGE", "ACTIVITY_UPDATE", "PROGRESS_UPDATE", "SYSTEM", "FORM_RENEWAL"];

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
        prev.map((item) => (item.type === type ? { ...item, enabled: !currentEnabled } : item)),
      );
    } catch (e) {
      setError(e.message || "Failed to save preference");
    } finally {
      setSaving("");
    }
  }

  const visiblePrefs = useMemo(
    () => preferences.filter((item) => PARENT_TYPES.includes(item.type)),
    [preferences],
  );

  const enabledCount = visiblePrefs.filter((item) => item.enabled).length;

  return (
    <ParentLayout title="Notification Settings">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Alerts center"
          title="Control how the parent portal gets your attention"
          description="Keep only the updates you need, while making sure urgent family and center communication still reaches you."
          accent="amber"
          stats={[
            { label: "Available alerts", value: visiblePrefs.length, hint: "Configurable categories", tone: "gray" },
            { label: "Enabled", value: enabledCount, hint: "Currently active", tone: enabledCount ? "emerald" : "amber" },
            { label: "Muted", value: visiblePrefs.length - enabledCount, hint: "Turned off", tone: "sky" },
            { label: "Auto-save", value: "On", hint: "Changes save instantly", tone: "amber" },
          ]}
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <ParentSection
          title="Notification channels"
          description="Switch categories on or off. Disabled categories will no longer appear in your notification bell."
          className="bg-gradient-to-br from-white via-amber-50/30 to-white"
        >
          {loading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading preferences...</div>
          ) : (
            <div className="space-y-3">
              {visiblePrefs.map((pref) => {
                const info = TYPE_LABELS[pref.type];
                if (!info) return null;
                const isSaving = saving === pref.type;
                return (
                  <div
                    key={pref.type}
                    className={[
                      "flex flex-col gap-3 rounded-[24px] border p-4 sm:flex-row sm:items-center sm:justify-between",
                      pref.enabled
                        ? "border-amber-200 bg-gradient-to-r from-amber-50 to-white dark:border-amber-800 dark:bg-amber-900/10"
                        : "border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-900/30",
                    ].join(" ")}
                  >
                    <div className="pr-3">
                      <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                        {info.label}
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {info.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePreference(pref.type, pref.enabled)}
                      disabled={isSaving}
                      className={[
                        "relative inline-flex h-7 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                        pref.enabled ? "bg-sky-600" : "bg-gray-300 dark:bg-gray-600",
                        isSaving ? "opacity-50" : "",
                      ].join(" ")}
                      role="switch"
                      aria-checked={pref.enabled}
                    >
                      <span
                        className={[
                          "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200",
                          pref.enabled ? "translate-x-7" : "translate-x-0",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
