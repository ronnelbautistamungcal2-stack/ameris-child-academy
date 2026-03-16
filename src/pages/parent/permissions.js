import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentPageHeader,
  ParentPill,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const PERMISSION_TYPES = [
  { value: "PHOTO_RELEASE", label: "Photo Release", description: "Allow photos and videos of your child for classroom updates and approved center use." },
  { value: "FIELD_TRIP", label: "Field Trip", description: "Allow off-campus supervised field trips and educational visits." },
  { value: "MEDICAL_TREATMENT", label: "Medical Treatment", description: "Allow staff to authorize emergency treatment if immediate care is required." },
  { value: "TRANSPORTATION", label: "Transportation", description: "Allow transport arranged by the center for approved activities." },
  { value: "SUNSCREEN_APPLICATION", label: "Sunscreen Application", description: "Allow staff to apply sunscreen during outdoor activities when appropriate." },
  { value: "WATER_ACTIVITIES", label: "Water Activities", description: "Allow supervised participation in splash play and similar activities." },
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
          (a.firstName || "").localeCompare(b.firstName || ""),
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
    if (selectedChildId) loadPermissions(selectedChildId);
  }, [selectedChildId, loadPermissions]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const permMap = useMemo(() => {
    const map = {};
    for (const permission of permissions) map[permission.permissionType] = permission;
    return map;
  }, [permissions]);

  const stats = useMemo(() => {
    const granted = permissions.filter((item) => item.status === "GRANTED").length;
    const denied = permissions.filter((item) => item.status === "DENIED").length;
    const pending = PERMISSION_TYPES.length - granted - denied;
    return { granted, denied, pending };
  }, [permissions]);

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
      setSuccess("Permission updated successfully.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message || "Failed to update permission");
    } finally {
      setSaving("");
    }
  }

  return (
    <ParentLayout title="Permissions">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Consent center"
          title="Manage family permissions with confidence"
          description="Switch between children, review what has already been approved, and make clear yes or no decisions without digging through paper forms."
          accent="emerald"
          layout="split"
          stats={[
            { label: "Children", value: children.length, hint: "Linked to this account", tone: "sky" },
            { label: "Granted", value: stats.granted, hint: "Currently approved", tone: "emerald" },
            { label: "Denied", value: stats.denied, hint: "Currently denied", tone: "rose" },
            { label: "Pending", value: stats.pending, hint: "Need a decision", tone: stats.pending ? "amber" : "gray" },
          ]}
        />

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

        <ParentSection
          title="Choose a child"
          description="Permissions are tracked separately for each child."
          className="bg-gradient-to-r from-white via-emerald-50/40 to-white"
        >
          {loading ? (
            <Skeleton count={2} />
          ) : children.length === 0 ? (
            <ParentEmpty
              title="No children found"
              description="Your account is not linked to any children yet."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <ParentPill
                  key={child.id}
                  active={child.id === selectedChildId}
                  onClick={() => setSelectedChildId(child.id)}
                >
                  {child.firstName} {child.lastName || ""}
                </ParentPill>
              ))}
            </div>
          )}
        </ParentSection>

        <ParentSection
          title={selectedChild ? `Permissions for ${selectedChild.firstName}` : "Permissions"}
          description="Each card shows the current decision and lets you change it immediately."
          className="bg-gradient-to-br from-white via-white to-emerald-50/30"
        >
          {permLoading ? (
            <Skeleton count={4} />
          ) : !selectedChild ? (
            <ParentEmpty
              title="Select a child first"
              description="Choose a child above to manage permissions."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {PERMISSION_TYPES.map((item) => {
                const permission = permMap[item.value];
                const status = permission?.status || "PENDING";
                const isGranted = status === "GRANTED";
                const isDenied = status === "DENIED";
                const isSaving = saving === item.value;
                return (
                  <div
                    key={item.value}
                    className={[
                      "rounded-[28px] border p-5 transition-all shadow-sm",
                      isGranted
                        ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                        : isDenied
                          ? "border-rose-200 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-900/20"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-extrabold",
                              isGranted
                                ? "border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : isDenied
                                  ? "border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                  : "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300",
                            ].join(" ")}
                          >
                            {status}
                          </span>
                          {permission?.grantedBy ? (
                            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Updated by {permission.grantedBy.name || permission.grantedBy.email}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isSaving || isGranted}
                          onClick={() => togglePermission(item.value, "GRANTED")}
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Grant"}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving || isDenied}
                          onClick={() => togglePermission(item.value, "DENIED")}
                          className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Deny"}
                        </button>
                      </div>
                    </div>
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
