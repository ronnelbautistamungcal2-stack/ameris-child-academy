import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const PERMISSION_TYPES = [
  { value: "PHOTO_RELEASE", label: "Photo Release", description: "Allow photos/videos of your child to be taken and used" },
  { value: "FIELD_TRIP", label: "Field Trip", description: "Allow your child to participate in field trips" },
  { value: "MEDICAL_TREATMENT", label: "Medical Treatment", description: "Allow emergency medical treatment if needed" },
  { value: "TRANSPORTATION", label: "Transportation", description: "Allow your child to be transported by the center" },
  { value: "SUNSCREEN_APPLICATION", label: "Sunscreen Application", description: "Allow staff to apply sunscreen to your child" },
  { value: "WATER_ACTIVITIES", label: "Water Activities", description: "Allow your child to participate in water activities" },
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

  const permMap = useMemo(() => {
    const map = {};
    for (const p of permissions) map[p.permissionType] = p;
    return map;
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
      setSuccess(`Permission updated successfully`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.message || "Failed to update permission");
    } finally {
      setSaving("");
    }
  }

  const selectedChild = children.find((c) => c.id === selectedChildId);

  return (
    <ParentLayout title="Permissions">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Child Permissions</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage permissions for your children. Grant or deny each permission type below.
          </p>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading...</div>
          ) : children.length === 0 ? (
            <div className="mt-4 text-sm text-gray-600">No children found.</div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {children.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChildId(ch.id)}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                      ch.id === selectedChildId
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {ch.firstName} {ch.lastName || ""}
                  </button>
                ))}
              </div>

              {selectedChild && (
                <div className="mt-4">
                  <h3 className="text-sm font-extrabold text-gray-800">
                    Permissions for {selectedChild.firstName} {selectedChild.lastName || ""}
                  </h3>

                  {permLoading ? (
                    <div className="mt-3 text-sm text-gray-600">Loading permissions...</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {PERMISSION_TYPES.map((pt) => {
                        const perm = permMap[pt.value];
                        const status = perm?.status || "PENDING";
                        const isGranted = status === "GRANTED";
                        const isDenied = status === "DENIED";
                        const isSaving = saving === pt.value;

                        return (
                          <div
                            key={pt.value}
                            className={[
                              "rounded-xl border p-4 transition",
                              isGranted
                                ? "border-green-200 bg-green-50"
                                : isDenied
                                  ? "border-red-200 bg-red-50"
                                  : "border-gray-200 bg-gray-50",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-gray-900">
                                  {pt.label}
                                </div>
                                <div className="mt-1 text-xs text-gray-600">
                                  {pt.description}
                                </div>
                                <div className="mt-2">
                                  <span
                                    className={[
                                      "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                                      isGranted
                                        ? "bg-green-100 text-green-800"
                                        : isDenied
                                          ? "bg-red-100 text-red-800"
                                          : "bg-gray-200 text-gray-600",
                                    ].join(" ")}
                                  >
                                    {status}
                                  </span>
                                  {perm?.grantedBy && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      by {perm.grantedBy.name || perm.grantedBy.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={isSaving || isGranted}
                                  onClick={() => togglePermission(pt.value, "GRANTED")}
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-xs font-extrabold transition",
                                    isGranted
                                      ? "cursor-default bg-green-200 text-green-800"
                                      : isSaving
                                        ? "cursor-not-allowed bg-green-400 text-white opacity-60"
                                        : "bg-green-600 text-white hover:bg-green-700",
                                  ].join(" ")}
                                >
                                  {isSaving ? "..." : "Grant"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving || isDenied}
                                  onClick={() => togglePermission(pt.value, "DENIED")}
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-xs font-extrabold transition",
                                    isDenied
                                      ? "cursor-default bg-red-200 text-red-800"
                                      : isSaving
                                        ? "cursor-not-allowed bg-red-400 text-white opacity-60"
                                        : "bg-red-600 text-white hover:bg-red-700",
                                  ].join(" ")}
                                >
                                  {isSaving ? "..." : "Deny"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ParentLayout>
  );
}
