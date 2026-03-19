import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const PERMISSION_TYPES = [
  {
    value: "PHOTO_RELEASE",
    label: "Photo Release",
    description:
      "Allow photos and videos of your child for classroom updates and approved center use.",
  },
  {
    value: "FIELD_TRIP",
    label: "Field Trip",
    description:
      "Allow off-campus supervised field trips and educational visits.",
  },
  {
    value: "MEDICAL_TREATMENT",
    label: "Medical Treatment",
    description:
      "Allow staff to authorize emergency treatment if immediate care is required.",
  },
  {
    value: "TRANSPORTATION",
    label: "Transportation",
    description:
      "Allow transport arranged by the center for approved activities.",
  },
  {
    value: "SUNSCREEN_APPLICATION",
    label: "Sunscreen Application",
    description:
      "Allow staff to apply sunscreen during outdoor activities when appropriate.",
  },
  {
    value: "WATER_ACTIVITIES",
    label: "Water Activities",
    description:
      "Allow supervised participation in splash play and similar activities.",
  },
];

const PERMISSION_GROUPS = [
  {
    id: "sharing",
    title: "Sharing and outings",
    description: "Media sharing and supervised experiences beyond the classroom.",
    tone: "sky",
    items: ["PHOTO_RELEASE", "FIELD_TRIP"],
  },
  {
    id: "care",
    title: "Health and care",
    description: "Everyday care decisions that help staff respond quickly and safely.",
    tone: "emerald",
    items: ["MEDICAL_TREATMENT", "SUNSCREEN_APPLICATION"],
  },
  {
    id: "activities",
    title: "Movement and play",
    description: "Permissions tied to transport and active play experiences.",
    tone: "amber",
    items: ["TRANSPORTATION", "WATER_ACTIVITIES"],
  },
];

export default function ParentPermissions() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const kids = await apiJson("/api/v1/children");
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          `${a.firstName || ""} ${a.lastName || ""}`.localeCompare(
            `${b.firstName || ""} ${b.lastName || ""}`,
          ),
        );
        setChildren(sorted);
        if (sorted.length) setSelectedChildId(sorted[0].id);
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPermissions = useCallback(async (childId) => {
    if (!childId) return;
    setPermLoading(true);
    setError("");
    try {
      const perms = await apiJson(`/api/v1/children/${childId}/permissions`);
      setPermissions(Array.isArray(perms) ? perms : []);
    } catch (e) {
      setError(e.message || "Failed to load permissions");
    } finally {
      setPermLoading(false);
    }
  }, []);

  useEffect(() => {
    setSuccess("");
    if (selectedChildId) loadPermissions(selectedChildId);
  }, [selectedChildId, loadPermissions]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const permMap = useMemo(() => {
    const map = {};
    for (const permission of permissions) {
      map[permission.permissionType] = permission;
    }
    return map;
  }, [permissions]);

  const stats = useMemo(() => {
    const granted = permissions.filter((item) => item.status === "GRANTED").length;
    const denied = permissions.filter((item) => item.status === "DENIED").length;
    const pending = PERMISSION_TYPES.length - granted - denied;
    return { granted, denied, pending };
  }, [permissions]);

  const completionRate = useMemo(() => {
    if (!PERMISSION_TYPES.length) return 0;
    return Math.round(((stats.granted + stats.denied) / PERMISSION_TYPES.length) * 100);
  }, [stats.denied, stats.granted]);

  const pendingItems = useMemo(
    () =>
      PERMISSION_TYPES.filter((item) => {
        const status = permMap[item.value]?.status || "PENDING";
        return status === "PENDING";
      }),
    [permMap],
  );

  const groupedPermissions = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        items: group.items
          .map((type) => PERMISSION_TYPES.find((item) => item.value === type))
          .filter(Boolean),
      })),
    [],
  );

  async function togglePermission(type, newStatus) {
    setSaving(type);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/children/${selectedChildId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ permissionType: type, status: newStatus }),
      });
      await loadPermissions(selectedChildId);
      setSuccess("Permissions updated.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message || "Failed to update permission");
    } finally {
      setSaving("");
    }
  }

  return (
    <ParentLayout title="Permissions">
      <div className="space-y-3">
        <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white p-4 shadow-[0_24px_80px_-48px_rgba(16,185,129,0.45)] dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/20" />

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Consent center
              </div>
              <h1 className="mt-2.5 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                Family permissions
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Manage approvals for the selected child in one place, with compact status tracking and fast yes-or-no actions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[420px]">
              <CompactStat
                label="Children"
                value={children.length}
                hint="Linked"
                tone="sky"
              />
              <CompactStat
                label="Approved"
                value={stats.granted}
                hint="Current child"
                tone="emerald"
              />
              <CompactStat
                label="Declined"
                value={stats.denied}
                hint="Recorded"
                tone="rose"
              />
              <CompactStat
                label="Pending"
                value={stats.pending}
                hint={stats.pending ? "To review" : "Done"}
                tone={stats.pending ? "amber" : "gray"}
              />
            </div>
          </div>
        </section>

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}
        {success ? (
          <ParentSurface className="border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {success}
          </ParentSurface>
        ) : null}

        <ParentSurface className="bg-gradient-to-r from-white via-sky-50/20 to-emerald-50/30 p-4 dark:from-gray-800 dark:via-gray-800 dark:to-emerald-950/10">
          {loading ? (
            <Skeleton count={3} />
          ) : children.length === 0 ? (
            <ParentEmpty
              title="No children found"
              description="Your account is not linked to any children yet."
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-[20px] border border-gray-200 bg-white/85 p-3 dark:border-gray-700 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Current child
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Switch child context here.
                    </div>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                    {children.length} linked
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {children.map((child) => {
                    const active = child.id === selectedChildId;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSelectedChildId(child.id)}
                        className={[
                          "flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 transition-all",
                          active
                            ? "border-sky-300 bg-sky-50 shadow-sm ring-2 ring-sky-100 dark:border-sky-700 dark:bg-sky-900/20 dark:ring-sky-900/40"
                            : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-800 dark:hover:bg-sky-950/10",
                        ].join(" ")}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-sky-500 to-cyan-500 text-xs font-black text-white shadow-sm">
                          {childInitials(child)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-black text-gray-900 dark:text-gray-100">
                            {child.firstName} {child.lastName || ""}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {formatChildAge(child.birthDate) || "Child profile"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!selectedChild ? (
                <ParentEmpty
                  title="Select a child first"
                  description="Choose a child to view the current permission overview."
                />
              ) : (
                <>
                  <div className="rounded-[20px] border border-emerald-200 bg-white/85 p-3 dark:border-emerald-800 dark:bg-slate-900/70">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 lg:flex-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-emerald-500 to-cyan-500 text-sm font-black text-white shadow-sm">
                            {childInitials(selectedChild)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-black tracking-tight text-gray-900 dark:text-gray-100">
                              {selectedChild.firstName} {selectedChild.lastName || ""}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                              <span>{formatChildAge(selectedChild.birthDate) || "Ready for review"}</span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                                Changes save immediately
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <div className="mt-1.5 text-[12px] text-gray-600 dark:text-gray-300">
                          {completionRate}% reviewed
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <SnapshotPill label="Approved" value={stats.granted} tone="emerald" />
                        <SnapshotPill label="Declined" value={stats.denied} tone="rose" />
                        <SnapshotPill
                          label="Pending"
                          value={stats.pending}
                          tone={stats.pending ? "amber" : "gray"}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-gray-200 bg-white/85 px-3 py-2.5 dark:border-gray-700 dark:bg-slate-900/70">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Focus next
                      </span>
                      {pendingItems.length ? (
                        <>
                          {pendingItems.slice(0, 3).map((item) => (
                            <span
                              key={item.value}
                              className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
                            >
                              {item.label}
                            </span>
                          ))}
                          {pendingItems.length > 3 ? (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                              +{pendingItems.length - 3} more
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Everything has a recorded decision.
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ParentSurface>

        <ParentSection
          title={selectedChild ? `Permissions for ${selectedChild.firstName}` : "Permissions"}
          description="Each decision is grouped by context so it is easier to review quickly and understand what it affects."
          action={
            selectedChild ? (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                {stats.pending ? `${stats.pending} awaiting review` : "All decisions recorded"}
              </span>
            ) : null
          }
          className="bg-gradient-to-br from-white via-white to-emerald-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-emerald-950/10"
          headerClassName="pb-3"
          bodyClassName="pt-3"
        >
          {permLoading ? (
            <Skeleton count={4} />
          ) : !selectedChild ? (
            <ParentEmpty
              title="Select a child first"
              description="Choose a child above to manage permissions."
            />
          ) : (
            <div className="space-y-3">
              {groupedPermissions.map((group) => (
                <div
                  key={group.id}
                  className="rounded-[22px] border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-700 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-black tracking-tight text-gray-900 dark:text-gray-100">
                        {group.title}
                      </div>
                      <div className="mt-0.5 text-[13px] text-gray-600 dark:text-gray-300">
                        {group.description}
                      </div>
                    </div>
                    <span className={groupBadgeClassName(group.tone)}>
                      {group.items.length} decisions
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                    {group.items.map((item) => {
                      const permission = permMap[item.value];
                      const status = permission?.status || "PENDING";
                      const isSaving = saving === item.value;

                      return (
                        <PermissionDecisionCard
                          key={item.value}
                          item={item}
                          permission={permission}
                          status={status}
                          isSaving={isSaving}
                          onGrant={() => togglePermission(item.value, "GRANTED")}
                          onDeny={() => togglePermission(item.value, "DENIED")}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ParentSection>
      </div>
    </ParentLayout>
  );
}

function PermissionDecisionCard({
  item,
  permission,
  status,
  isSaving,
  onGrant,
  onDeny,
}) {
  const meta = permissionStatusMeta(status);
  const updatedBy = permission?.grantedBy?.name || permission?.grantedBy?.email || "";
  const updatedAt = formatPermissionTimestamp(
    permission?.updatedAt || permission?.effectiveDate || permission?.createdAt,
  );

  return (
    <div className={`rounded-[20px] border p-3.5 shadow-sm ${meta.cardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-black tracking-tight text-gray-900 dark:text-gray-100">
            {item.label}
          </div>
          <div className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
            {item.description}
          </div>
        </div>
        <span className={`${meta.pillClassName} shrink-0`}>{meta.label}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-600 dark:text-gray-300">
        {updatedBy ? (
          <>
            <span>
              Updated by{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {updatedBy}
              </span>
            </span>
            {updatedAt ? (
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-400">
                {updatedAt}
              </span>
            ) : null}
          </>
        ) : (
          <span>No decision recorded yet.</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSaving || status === "GRANTED"}
            onClick={onGrant}
            className={[
              "rounded-2xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
              status === "GRANTED"
                ? "bg-emerald-500 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-800 hover:border-emerald-200 hover:bg-emerald-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30",
            ].join(" ")}
          >
            {isSaving && status !== "DENIED" ? "Saving..." : "Allow"}
          </button>

          <button
            type="button"
            disabled={isSaving || status === "DENIED"}
            onClick={onDeny}
            className={[
              "rounded-2xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
              status === "DENIED"
                ? "bg-rose-500 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-800 hover:border-rose-200 hover:bg-rose-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-rose-800 dark:hover:bg-rose-950/30",
            ].join(" ")}
          >
            {isSaving && status !== "GRANTED" ? "Saving..." : "Not now"}
          </button>

        <div className="ml-auto self-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {status === "PENDING"
            ? "Waiting for your decision"
            : status === "GRANTED"
              ? "Permission is active"
              : "Permission is turned off"}
        </div>
      </div>
    </div>
  );
}

function SnapshotPill({ label, value, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100",
    emerald:
      "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${tones[tone] || tones.sky}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="text-base font-black tracking-tight">{value}</div>
    </div>
  );
}

function CompactStat({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100",
    emerald:
      "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100",
  };

  return (
    <div className={`rounded-[18px] border px-3 py-2.5 ${tones[tone] || tones.sky}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-1.5 text-xl font-black tracking-tight">{value}</div>
      <div className="text-[11px] text-current/70">{hint}</div>
    </div>
  );
}

function permissionStatusMeta(status) {
  if (status === "GRANTED") {
    return {
      label: "Allowed",
      pillClassName:
        "rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
      cardClassName:
        "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/10",
    };
  }

  if (status === "DENIED") {
    return {
      label: "Not allowed",
      pillClassName:
        "rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
      cardClassName:
        "border-rose-200 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/10",
    };
  }

  return {
    label: "Pending",
    pillClassName:
      "rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    cardClassName:
      "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
  };
}

function groupBadgeClassName(tone) {
  const tones = {
    sky: "rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200",
    emerald:
      "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    amber:
      "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  };

  return tones[tone] || tones.sky;
}

function childInitials(child) {
  return `${String(child?.firstName || "").slice(0, 1)}${String(child?.lastName || "").slice(0, 1) || String(child?.firstName || "").slice(1, 2)}`.toUpperCase() || "CH";
}

function formatChildAge(value) {
  if (!value) return "";
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return "";

  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());

  if (now.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  if (months < 0) return "";
  if (months < 24) return `${months}mo old`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}y ${remainingMonths}mo old` : `${years}y old`;
}

function formatPermissionTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
