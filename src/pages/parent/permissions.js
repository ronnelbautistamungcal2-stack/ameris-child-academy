import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import {
  DEFAULT_PERMISSION_POLICIES,
  PERMISSION_GROUPS,
} from "@/lib/permissionPolicies";
import { useCallback, useEffect, useMemo, useState } from "react";

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value) {
  if (!value) return todayDateValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayDateValue();
  return date.toISOString().slice(0, 10);
}

export default function ParentPermissions() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [decisionForm, setDecisionForm] = useState({
    signatureName: "",
    decisionDate: todayDateValue(),
    notes: "",
  });
  const [permissionTypes, setPermissionTypes] = useState(DEFAULT_PERMISSION_POLICIES);

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

  useEffect(() => {
    setActiveItem(null);
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = selectedChild?.centerId
          ? `?centerId=${encodeURIComponent(selectedChild.centerId)}`
          : "";
        const data = await apiJson(`/api/v1/permission-policy-config${qs}`);
        if (!cancelled && Array.isArray(data) && data.length) {
          setPermissionTypes(data);
        }
      } catch {
        if (!cancelled) setPermissionTypes(DEFAULT_PERMISSION_POLICIES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChild?.centerId]);

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
    const pending = permissionTypes.length - granted - denied;
    return { granted, denied, pending };
  }, [permissions, permissionTypes.length]);

  const completionRate = useMemo(() => {
    if (!permissionTypes.length) return 0;
    return Math.round(((stats.granted + stats.denied) / permissionTypes.length) * 100);
  }, [stats.denied, stats.granted, permissionTypes.length]);

  const pendingItems = useMemo(
    () =>
      permissionTypes.filter((item) => {
        const status = permMap[item.value]?.status || "PENDING";
        return status === "PENDING";
      }),
    [permMap, permissionTypes],
  );

  const groupedPermissions = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        items: group.items
          .map((type) => permissionTypes.find((item) => item.value === type))
          .filter(Boolean),
      })),
    [permissionTypes],
  );

  function openDecisionModal(item) {
    const permission = permMap[item.value];
    setActiveItem(item);
    setDecisionForm({
      signatureName: permission?.signatureName || "",
      decisionDate: toDateInputValue(permission?.signedAt || permission?.effectiveDate),
      notes: permission?.notes || "",
    });
    setError("");
    setSuccess("");
  }

  function closeDecisionModal() {
    setActiveItem(null);
    setDecisionForm({
      signatureName: "",
      decisionDate: todayDateValue(),
      notes: "",
    });
  }

  async function savePermissionDecision(type, newStatus) {
    if (!activeItem || !selectedChildId) return;
    if (!decisionForm.signatureName.trim()) {
      setError("Signature name is required before you can submit a permission decision.");
      return;
    }

    setSaving(type);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/children/${selectedChildId}/permissions`, {
        method: "POST",
        body: JSON.stringify({
          permissionType: type,
          status: newStatus,
          signatureName: decisionForm.signatureName.trim(),
          effectiveDate: decisionForm.decisionDate,
          notes: decisionForm.notes || null,
        }),
      });
      await loadPermissions(selectedChildId);
      closeDecisionModal();
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
                Review each policy, add your e-signature, and record a clear grant-or-deny decision for the selected child.
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
                                Policy review required
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
                          onReview={() => openDecisionModal(item)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ParentSection>
        {activeItem ? (
          <PermissionPolicyModal
            item={activeItem}
            permission={permMap[activeItem.value]}
            saving={saving === activeItem.value}
            form={decisionForm}
            onChange={setDecisionForm}
            onClose={closeDecisionModal}
            onGrant={() => savePermissionDecision(activeItem.value, "GRANTED")}
            onDeny={() => savePermissionDecision(activeItem.value, "DENIED")}
          />
        ) : null}
      </div>
    </ParentLayout>
  );
}

function PermissionDecisionCard({
  item,
  permission,
  status,
  isSaving,
  onReview,
}) {
  const meta = permissionStatusMeta(status);
  const updatedBy = permission?.grantedBy?.name || permission?.grantedBy?.email || "";
  const updatedAt = formatPermissionTimestamp(
    permission?.updatedAt || permission?.effectiveDate || permission?.createdAt,
  );
  const signedAt = formatPermissionTimestamp(permission?.signedAt || permission?.effectiveDate);
  const signatureName = permission?.signatureName || "";

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

      {signatureName && signedAt ? (
        <div className="mt-2 rounded-2xl border border-gray-200 bg-white/80 px-3 py-2 text-[12px] text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
          Signed by <span className="font-semibold text-gray-900 dark:text-gray-100">{signatureName}</span> on {signedAt}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onReview}
          className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-800 transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
        >
          {isSaving ? "Saving..." : status === "PENDING" ? "Review details" : "Review / update"}
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

function PermissionPolicyModal({ item, permission, form, saving, onChange, onClose, onGrant, onDeny }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              Policy review
            </div>
            <div className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
              {item.label}
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.policySummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-[22px] border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-slate-900/70">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              What you are signing
            </div>
            <div className="mt-3 space-y-3">
              {item.policySections.map((section) => (
                <div key={section} className="rounded-2xl border border-white bg-white px-4 py-3 text-sm leading-6 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                  {section}
                </div>
              ))}
            </div>
            {item.policyDocument ? (
              <a
                href={item.policyDocument.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-700 no-underline transition hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300"
              >
                View full policy document: {item.policyDocument.title}
              </a>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                E-signature
              </div>
              <input
                value={form.signatureName}
                onChange={(event) => onChange((current) => ({ ...current, signatureName: event.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
                placeholder="Type your full name"
              />
            </label>
            <label className="block">
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Decision date
              </div>
              <input
                type="date"
                value={form.decisionDate}
                onChange={(event) => onChange((current) => ({ ...current, decisionDate: event.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Notes
              </div>
              <textarea
                value={form.notes}
                onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
                placeholder="Optional notes about this decision"
              />
            </label>
          </div>

          {permission?.signatureName || permission?.signedAt ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
              Last signed decision: {permission?.signatureName || "Recorded"}{permission?.signedAt ? ` on ${formatPermissionTimestamp(permission.signedAt)}` : ""}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onDeny}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-950/30"
            >
              {saving ? "Saving..." : "Deny permission"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onGrant}
              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Grant permission"}
            </button>
          </div>
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
