import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPageHeader,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ParentInvolvement() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [activities, setActivities] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    activityId: "",
    childId: "",
    notes: "",
    occurredAt: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, ch, r] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/children").catch(() => []),
          apiJson("/api/v1/parent-involvement").catch(() => []),
        ]);
        const centerArr = Array.isArray(c) ? c : [];
        setCenters(centerArr);
        if (centerArr.length === 1) setCenterId(centerArr[0].id);
        setChildren(Array.isArray(ch) ? ch : []);
        setRecords(Array.isArray(r) ? r : []);
      } catch (e) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadActivities = useCallback(async () => {
    if (!centerId) { setActivities([]); return; }
    try {
      const data = await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}`);
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      setActivities([]);
    }
  }, [centerId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const loadRecords = useCallback(async () => {
    try {
      const data = await apiJson("/api/v1/parent-involvement");
      setRecords(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.activityId) { setError("Please select an activity."); return; }
    setSaving(true);
    try {
      await apiJson("/api/v1/parent-involvement", {
        method: "POST",
        body: JSON.stringify({
          activityId: form.activityId,
          childId: form.childId || null,
          notes: form.notes || null,
          occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
        }),
      });
      setSuccess("Involvement logged successfully!");
      setForm({ activityId: "", childId: "", notes: "", occurredAt: new Date().toISOString().slice(0, 16) });
      await loadRecords();
    } catch (e) {
      setError(e.message || "Failed to log involvement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ParentLayout title="Parent Involvement">
      <ParentPageHeader
        title="Parent Involvement"
        subtitle="Log your participation in your child's education and care."
      />

      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4 mt-4">
          {/* Log new involvement */}
          <ParentSurface>
            <ParentSection title="Log Involvement">
              {error ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              ) : null}
              {success ? (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
              ) : null}

              {centers.length > 1 && (
                <div className="mb-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Center</span>
                    <select
                      value={centerId}
                      onChange={(e) => setCenterId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select a center…</option>
                      {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {!centerId ? (
                <p className="text-sm text-gray-500">Select a center to see available activities.</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-gray-500">No involvement activities have been set up yet. Please check back soon.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Activity *</span>
                    <select
                      value={form.activityId}
                      onChange={(e) => setForm({ ...form, activityId: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select an activity…</option>
                      {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                    {form.activityId && activities.find((a) => a.id === form.activityId)?.description && (
                      <p className="mt-1 text-xs text-gray-500">{activities.find((a) => a.id === form.activityId).description}</p>
                    )}
                  </label>

                  {children.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Child (optional)</span>
                      <select
                        value={form.childId}
                        onChange={(e) => setForm({ ...form, childId: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="">All / General</option>
                        {children.map((ch) => (
                          <option key={ch.id} value={ch.id}>{ch.firstName} {ch.lastName}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Date & Time</span>
                    <input
                      type="datetime-local"
                      value={form.occurredAt}
                      onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notes (optional)</span>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                      placeholder="Add any notes about your participation…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>

                  <ParentButton type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Log Involvement"}
                  </ParentButton>
                </form>
              )}
            </ParentSection>
          </ParentSurface>

          {/* History */}
          <ParentSurface>
            <ParentSection title="My Involvement History">
              {records.length === 0 ? (
                <ParentEmpty message="No involvement has been logged yet. Use the form above to get started." />
              ) : (
                <div className="space-y-2">
                  {records.map((r) => (
                    <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-gray-900">{r.activity?.title}</div>
                          {r.child && (
                            <div className="text-xs text-gray-500">For {r.child.firstName} {r.child.lastName}</div>
                          )}
                          {r.notes && <div className="mt-1 text-xs text-gray-600">{r.notes}</div>}
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.occurredAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ParentSection>
          </ParentSurface>
        </div>
      )}
    </ParentLayout>
  );
}
