import { ParentButton, ParentEmpty, ParentSurface } from "@/components/parent/ParentUI";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TYPE_LABELS = {
  MESSAGE: {
    label: "Messages",
    description: "Get notified when teachers or staff send a direct message.",
    group: "essential",
    recommended: true,
    helper: "Best kept on so family-specific questions do not get buried.",
  },
  ACTIVITY_UPDATE: {
    label: "Activity updates",
    description: "See new care logs, meals, naps, and classroom moments.",
    group: "child_updates",
    recommended: true,
    helper: "Helpful when you want a steady daily pulse from the classroom.",
  },
  PROGRESS_UPDATE: {
    label: "Progress updates",
    description: "Get notified when teachers record developmental progress.",
    group: "child_updates",
    recommended: true,
    helper: "Useful for checking milestone movement without opening the full report.",
  },
  SYSTEM: {
    label: "System announcements",
    description: "Important portal changes and service-wide reminders.",
    group: "essential",
    recommended: true,
    helper: "Keep this on for account-wide notices and urgent service updates.",
  },
  FORM_RENEWAL: {
    label: "Form renewals",
    description: "See reminders before enrollment or medical forms expire.",
    group: "essential",
    recommended: true,
    helper: "Best kept on so renewal deadlines do not delay care or billing workflows.",
  },
};

const PARENT_TYPES = [
  "MESSAGE",
  "ACTIVITY_UPDATE",
  "PROGRESS_UPDATE",
  "SYSTEM",
  "FORM_RENEWAL",
];

const ESSENTIAL_TYPES = ["MESSAGE", "SYSTEM", "FORM_RENEWAL"];

const PREFERENCE_GROUPS = [
  {
    id: "essential",
    title: "Must-see alerts",
    description:
      "Core reminders that usually matter most for time-sensitive family follow-through.",
    tone: "emerald",
  },
  {
    id: "child_updates",
    title: "Child updates",
    description:
      "Daily classroom signals that help you stay informed without opening every report.",
    tone: "sky",
  },
];

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [batchSaving, setBatchSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);

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

  const prefMap = useMemo(() => {
    const map = {};
    PARENT_TYPES.forEach((type) => {
      map[type] = true;
    });
    preferences.forEach((item) => {
      if (PARENT_TYPES.includes(item.type)) {
        map[item.type] = Boolean(item.enabled);
      }
    });
    return map;
  }, [preferences]);

  const visiblePrefs = useMemo(
    () =>
      PARENT_TYPES.map((type) => ({
        type,
        enabled: prefMap[type] !== false,
        ...TYPE_LABELS[type],
      })).filter((item) => item.label),
    [prefMap],
  );

  const enabledCount = visiblePrefs.filter((item) => item.enabled).length;
  const mutedCount = visiblePrefs.length - enabledCount;
  const essentialOnCount = visiblePrefs.filter(
    (item) => ESSENTIAL_TYPES.includes(item.type) && item.enabled,
  ).length;
  const childUpdateCount = visiblePrefs.filter(
    (item) => item.group === "child_updates" && item.enabled,
  ).length;

  const groupedPreferences = useMemo(
    () =>
      PREFERENCE_GROUPS.map((group) => {
        const items = visiblePrefs.filter((item) => item.group === group.id);
        return {
          ...group,
          items,
          enabledCount: items.filter((item) => item.enabled).length,
        };
      }).filter((group) => group.items.length > 0),
    [visiblePrefs],
  );

  const currentMode = useMemo(() => {
    if (!visiblePrefs.length) return "Preparing";
    if (enabledCount === visiblePrefs.length) return "Full";
    if (
      essentialOnCount === ESSENTIAL_TYPES.length &&
      childUpdateCount === 0 &&
      mutedCount > 0
    ) {
      return "Focused";
    }
    return "Custom";
  }, [childUpdateCount, enabledCount, essentialOnCount, mutedCount, visiblePrefs.length]);

  const busy = loading || Boolean(saving) || Boolean(batchSaving);

  async function updatePreference(type, nextEnabled, options = {}) {
    const { quiet = false } = options;

    setSaving(type);
    if (!quiet) {
      setError("");
      setSuccess("");
    }

    try {
      await apiJson("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ type, enabled: nextEnabled }),
      });
      setPreferences((prev) =>
        prev.some((item) => item.type === type)
          ? prev.map((item) =>
              item.type === type ? { ...item, enabled: nextEnabled } : item,
            )
          : [...prev, { type, enabled: nextEnabled }],
      );
      setLastSavedAt(new Date());
      if (!quiet) {
        setSuccess(
          `${TYPE_LABELS[type]?.label || "Notification"} ${nextEnabled ? "enabled" : "muted"}.`,
        );
      }
    } catch (e) {
      const message = e.message || "Failed to save preference";
      setError(message);
      throw e;
    } finally {
      setSaving("");
    }
  }

  async function applyPreset(enabledTypes, successMessage) {
    const nextEnabled = new Set(enabledTypes);
    const changes = visiblePrefs.filter(
      (item) => item.enabled !== nextEnabled.has(item.type),
    );

    if (!changes.length) {
      setError("");
      setSuccess(successMessage);
      return;
    }

    setBatchSaving(successMessage);
    setError("");
    setSuccess("");
    try {
      await Promise.all(
        changes.map((item) =>
          apiJson("/api/v1/notifications/preferences", {
            method: "PUT",
            body: JSON.stringify({
              type: item.type,
              enabled: nextEnabled.has(item.type),
            }),
          }),
        ),
      );

      setPreferences((prev) => {
        const map = {};
        prev.forEach((item) => {
          map[item.type] = item;
        });
        PARENT_TYPES.forEach((type) => {
          map[type] = {
            ...(map[type] || { type }),
            enabled: nextEnabled.has(type),
          };
        });
        return Object.values(map);
      });
      setLastSavedAt(new Date());
      setSuccess(successMessage);
    } catch (e) {
      setError(e.message || "Failed to update preferences");
    } finally {
      setBatchSaving("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
            Mode: {currentMode}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
            {enabledCount} enabled
          </span>
          <span
            className={
              mutedCount
                ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                : "rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300"
            }
          >
            {mutedCount} muted
          </span>
          {lastSavedAt ? (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
              Last saved {formatSavedAt(lastSavedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ParentButton
            variant="secondary"
            onClick={() => applyPreset(PARENT_TYPES, "All parent alerts are now enabled.")}
            disabled={busy}
          >
            {batchSaving === "All parent alerts are now enabled."
              ? "Applying..."
              : "Turn all on"}
          </ParentButton>
          <ParentButton
            variant="soft"
            onClick={() =>
              applyPreset(ESSENTIAL_TYPES, "Only essential parent alerts will stay on.")
            }
            disabled={busy}
          >
            {batchSaving === "Only essential parent alerts will stay on."
              ? "Applying..."
              : "Keep essentials only"}
          </ParentButton>
        </div>
      </div>

      {error ? (
        <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </ParentSurface>
      ) : null}

      {success ? (
        <ParentSurface className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {success}
        </ParentSurface>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[22px] border border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-900/50"
            />
          ))}
        </div>
      ) : !visiblePrefs.length ? (
        <ParentEmpty
          title="No parent notification settings found"
          description="This account does not have any parent-facing alert categories yet."
        />
      ) : (
        <div className="space-y-4">
          {groupedPreferences.map((group) => (
            <div
              key={group.id}
              className="rounded-[26px] border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {group.title}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {group.description}
                  </div>
                </div>
                <span className={groupSummaryTone(group.tone)}>
                  {group.enabledCount}/{group.items.length} on
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <PreferenceCard
                    key={item.type}
                    preference={item}
                    saving={saving === item.type}
                    disabled={Boolean(batchSaving)}
                    onToggle={() =>
                      updatePreference(item.type, !item.enabled).catch(() => null)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[22px] border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-sky-900 dark:bg-sky-950/20 dark:text-gray-300">
        Muting a category only stops it from surfacing through the notification bell. The
        underlying pages stay available, so you can always open messages, forms, progress,
        or a child record directly when you want more context.
      </div>
    </div>
  );
}

function PreferenceCard({ preference, saving, disabled, onToggle }) {
  const enabled = preference.enabled;

  return (
    <div
      className={[
        "rounded-[22px] border p-4 transition-all",
        enabled
          ? "border-sky-200 bg-gradient-to-r from-sky-50/90 to-white dark:border-sky-800 dark:bg-sky-950/20"
          : "border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-900/40",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              {preference.label}
            </div>
            {preference.recommended ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                Recommended
              </span>
            ) : null}
            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]",
                enabled
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200"
                  : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300",
              ].join(" ")}
            >
              {enabled ? "On" : "Off"}
            </span>
          </div>
          <div className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {preference.description}
          </div>
          <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {preference.helper}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={saving || disabled}
          role="switch"
          aria-checked={enabled}
          className={[
            "relative inline-flex h-7 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
            enabled ? "bg-sky-600" : "bg-gray-300 dark:bg-gray-600",
            saving || disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200",
              enabled ? "translate-x-7" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}

function groupSummaryTone(tone = "sky") {
  const tones = {
    sky: "rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200",
    emerald:
      "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200",
  };

  return tones[tone] || tones.sky;
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
