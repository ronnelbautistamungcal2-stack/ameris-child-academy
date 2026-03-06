import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["PARENT", "TEACHER", "COACH", "SUBSCRIBER"];

export default function AdminInvites() {
  const [invites, setInvites] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [centerId, setCenterId] = useState("");
  const [role, setRole] = useState("PARENT");
  const [code, setCode] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [c, i] = await Promise.all([
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/invites"),
      ]);
      const centersArr = Array.isArray(c) ? c : [];
      setCenters(centersArr);
      if (!centerId) setCenterId(centersArr[0]?.id || "");
      setInvites(Array.isArray(i) ? i : []);
    } catch (e) {
      setError(e.message || "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...invites].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [invites]);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await apiJson("/api/v1/invites", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          role,
          code: code ? code.trim().toUpperCase() : undefined,
        }),
      });
      setCode("");
      setSuccess(`Invite created: ${created.code}`);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create invite");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(inv) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/invites/${inv.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !inv.active }),
      });
      setSuccess(`Invite ${inv.active ? "disabled" : "enabled"}.`);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to update invite");
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Copied to clipboard.");
    } catch {
      setSuccess("Copy not available in this browser.");
    }
  }

  return (
    <AdminLayout title="Invite Codes">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-extrabold text-gray-900">Invite Codes</h2>
        <p className="mt-1 text-sm text-gray-600">
          Create invite codes for parents and staff to join a center.
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

        <form onSubmit={create} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_1fr_140px]">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm"
              required
            >
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Role
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm"
              required
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Custom Code (optional)
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm font-mono"
              placeholder="PARENT2026"
            />
          </label>

          <button
            type="submit"
            disabled={saving || !centerId}
            className="mt-6 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>

        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent Invites
          </div>

          {loading ? (
            <div className="mt-3"><SkeletonTable rows={3} cols={3} /></div>
          ) : sorted.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">No invites yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {sorted.slice(0, 50).map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-gray-900">
                        {inv.role}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-mono text-xs font-extrabold text-gray-900">
                        {inv.code}
                      </span>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-extrabold",
                          inv.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-700",
                        ].join(" ")}
                      >
                        {inv.active ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      Center: <span className="font-semibold">{inv.center?.name || inv.centerId}</span>{" "}
                      · Created {new Date(inv.createdAt).toLocaleString()}
                      {inv.expiresAt ? (
                        <>
                          {" "}
                          · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copy(inv.code)}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(inv)}
                      className={[
                        "rounded-2xl px-4 py-2 text-sm font-extrabold text-white",
                        inv.active ? "bg-gray-700 hover:bg-gray-800" : "bg-green-600 hover:bg-green-700",
                      ].join(" ")}
                    >
                      {inv.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

