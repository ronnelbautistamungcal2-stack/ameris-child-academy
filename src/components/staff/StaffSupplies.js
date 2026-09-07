import Skeleton from "@/components/ui/Skeleton";
import { WorkspaceSection } from "@/components/ui/Workspace";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_TONE = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-sky-100 text-sky-800",
  FULFILLED: "bg-emerald-100 text-emerald-800",
  DENIED: "bg-gray-200 text-gray-700",
};

const EMPTY_FORM = { item: "", quantity: 1, purpose: "", notes: "" };

function formatStatus(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * "Supplies Needed" and "Request Supplies" for the Other Staff checklist page.
 * Supplies Needed is the staff member's own open requests (anything not yet
 * fulfilled or denied); the form below files a new one with the admin.
 */
export default function StaffSupplies({ centerId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = useCallback(async () => {
    if (!centerId) {
      setRequests([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/supply-requests?centerId=${encodeURIComponent(centerId)}`,
      );
      setRequests(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load supply requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openRequests = useMemo(
    () => requests.filter((request) => request.status === "PENDING" || request.status === "APPROVED"),
    [requests],
  );

  const recentlyFulfilled = useMemo(
    () => requests.filter((request) => request.status === "FULFILLED").slice(0, 5),
    [requests],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!centerId || !form.item.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/supply-requests", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          item: form.item.trim(),
          quantity: Number(form.quantity) || 1,
          purpose: form.purpose || null,
          notes: form.notes || null,
        }),
      });
      setSuccess("Supply request sent to your administrator.");
      setForm(EMPTY_FORM);
      await loadRequests();
    } catch (nextError) {
      setError(nextError.message || "Failed to send supply request");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none";
  const labelClass = "text-xs font-black uppercase tracking-[0.16em] text-gray-500";

  return (
    <>
      <WorkspaceSection
        title="Supplies Needed"
        description="Items you have asked for that are still open."
      >
        {error ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!centerId ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Select a center to see your supply requests.
          </div>
        ) : loading ? (
          <Skeleton count={3} />
        ) : !openRequests.length ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            You have no open supply requests. Use the form below to ask for something.
          </div>
        ) : (
          <div className="space-y-3">
            {openRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-gray-900">
                    {request.item}
                    <span className="ml-2 text-xs font-bold text-gray-500">
                      x{request.quantity}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      STATUS_TONE[request.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatStatus(request.status)}
                  </span>
                </div>
                {request.purpose ? (
                  <div className="mt-1 text-sm text-gray-600">{request.purpose}</div>
                ) : null}
                {request.notes ? (
                  <div className="mt-1 text-xs text-gray-500">{request.notes}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-gray-400">
                  Requested {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {recentlyFulfilled.length ? (
          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
              Recently fulfilled
            </div>
            <div className="mt-2 space-y-1.5">
              {recentlyFulfilled.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-gray-800">
                    {request.item} x{request.quantity}
                  </span>
                  <span className="text-gray-500">
                    {new Date(request.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </WorkspaceSection>

      <WorkspaceSection
        title="Request Supplies"
        description="Ask your administrator for supplies you need to complete your tasks."
      >
        {!centerId ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Select a center before submitting a request.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {success}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
              <label className="block">
                <div className={labelClass}>Item</div>
                <input
                  type="text"
                  value={form.item}
                  onChange={(event) => setForm({ ...form, item: event.target.value })}
                  className={`mt-1 ${inputClass}`}
                  placeholder="e.g. Paper towels"
                  required
                />
              </label>
              <label className="block">
                <div className={labelClass}>Quantity</div>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: parseInt(event.target.value, 10) || 1 })
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>

            <label className="block">
              <div className={labelClass}>Purpose</div>
              <input
                type="text"
                value={form.purpose}
                onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                className={`mt-1 ${inputClass}`}
                placeholder="What this is for (optional)"
              />
            </label>

            <label className="block">
              <div className={labelClass}>Notes</div>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className={`mt-1 ${inputClass}`}
                placeholder="Brand, size, or other details (optional)"
              />
            </label>

            <button
              type="submit"
              disabled={saving || !form.item.trim()}
              className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Sending..." : "Send Request"}
            </button>
          </form>
        )}
      </WorkspaceSection>
    </>
  );
}
