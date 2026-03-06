import CoachLayout from "@/components/coach/CoachLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const TYPES = [
  { value: "PARENT", label: "Parent" },
  { value: "CAMERA_OBSERVATION", label: "Camera Observation" },
  { value: "GENERAL", label: "General" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function CoachFollowUps() {
  const router = useRouter();
  const { centerId: qCenterId } = router.query;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("OPEN");

  const [form, setForm] = useState({
    type: "PARENT", priority: "MEDIUM", title: "", description: "",
    dueDate: "", assignedToId: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        setCenterId(qCenterId || (arr.length === 1 ? arr[0].id : ""));
      } catch {}
    })();
  }, [qCenterId]);

  const fetchFollowUps = async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    try {
      let url = `/api/v1/coach/follow-ups?centerId=${encodeURIComponent(centerId)}`;
      if (filterStatus !== "ALL") url += `&status=${filterStatus}`;
      if (filterType !== "ALL") url += `&type=${filterType}`;
      const [data, dashData] = await Promise.all([
        apiJson(url),
        apiJson(`/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setFollowUps(Array.isArray(data) ? data : []);
      setTeachers(dashData?.teachers || []);
    } catch (e) {
      setError(e.message || "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFollowUps(); }, [centerId, filterType, filterStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !centerId) return;
    setSaving(true);
    try {
      const created = await apiJson("/api/v1/coach/follow-ups", {
        method: "POST",
        body: JSON.stringify({ ...form, centerId }),
      });
      setFollowUps((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ type: "PARENT", priority: "MEDIUM", title: "", description: "", dueDate: "", assignedToId: "", notes: "" });
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await apiJson("/api/v1/coach/follow-ups", {
        method: "PUT",
        body: JSON.stringify({ id, status }),
      });
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (e) {
      setError(e.message || "Failed to update");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this follow-up?")) return;
    try {
      await apiJson(`/api/v1/coach/follow-ups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  };

  return (
    <CoachLayout title="Follow-ups">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Follow-ups</h2>
            <p className="mt-1 text-sm text-gray-600">
              Track parent follow-ups, camera observation follow-ups, and general tasks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {centers.length > 1 && (
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="">Select center...</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setShowForm(!showForm)} disabled={!centerId} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50">
              {showForm ? "Cancel" : "+ New Follow-up"}
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {/* New Form */}
        {showForm && centerId && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="font-extrabold text-gray-900">New Follow-up</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Assign to Teacher</label>
                <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-gray-600">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Follow-up title..." required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={3} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
            </div>
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving..." : "Create Follow-up"}
            </button>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {[{ value: "ALL", label: "All Types" }, ...TYPES].map((t) => (
              <button key={t.value} type="button" onClick={() => setFilterType(t.value)} className={[
                "rounded-full px-3 py-1.5 text-xs font-extrabold transition",
                filterType === t.value ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {[{ value: "ALL", label: "Any Status" }, ...STATUSES].map((s) => (
              <button key={s.value} type="button" onClick={() => setFilterStatus(s.value)} className={[
                "rounded-full px-3 py-1.5 text-xs font-extrabold transition",
                filterStatus === s.value ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Follow-ups List */}
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><SkeletonTable rows={5} cols={4} /></div>
        ) : followUps.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No follow-ups found.
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map((fu) => (
              <div key={fu.id} className={[
                "rounded-2xl border p-5",
                fu.status === "COMPLETED" ? "border-green-200 bg-green-50/50" :
                fu.status === "CANCELLED" ? "border-gray-200 bg-gray-50 opacity-60" :
                fu.priority === "CRITICAL" ? "border-red-200 bg-white" :
                fu.priority === "HIGH" ? "border-orange-200 bg-white" :
                "border-gray-200 bg-white",
              ].join(" ")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-gray-900">{fu.title}</span>
                      <TypeBadge type={fu.type} />
                      <PriorityBadge priority={fu.priority} />
                      <StatusBadge status={fu.status} />
                    </div>
                    {fu.description && <div className="mt-1 text-sm text-gray-600">{fu.description}</div>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      {fu.assignedTo && <span>Assigned: {fu.assignedTo.name || fu.assignedTo.email}</span>}
                      {fu.dueDate && <span>Due: {fmtDate(fu.dueDate)}</span>}
                      <span>Created: {fmtDate(fu.createdAt)}</span>
                      {fu.createdBy && <span>By: {fu.createdBy.name || fu.createdBy.email}</span>}
                    </div>
                    {fu.notes && <div className="mt-2 rounded-xl bg-gray-50 p-2 text-sm text-gray-700">{fu.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {fu.status === "OPEN" && (
                      <button type="button" onClick={() => handleStatusChange(fu.id, "IN_PROGRESS")} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        Start
                      </button>
                    )}
                    {(fu.status === "OPEN" || fu.status === "IN_PROGRESS") && (
                      <button type="button" onClick={() => handleStatusChange(fu.id, "COMPLETED")} className="rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-100">
                        Complete
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(fu.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CoachLayout>
  );
}

function TypeBadge({ type }) {
  const cls = {
    PARENT: "bg-amber-50 text-amber-700",
    CAMERA_OBSERVATION: "bg-purple-50 text-purple-700",
    GENERAL: "bg-gray-100 text-gray-700",
  }[type] || "bg-gray-100 text-gray-700";
  const label = { PARENT: "Parent", CAMERA_OBSERVATION: "Camera Obs.", GENERAL: "General" }[type] || type;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function PriorityBadge({ priority }) {
  const cls = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-gray-100 text-gray-600",
  }[priority] || "bg-gray-100 text-gray-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${cls}`}>{priority}</span>;
}

function StatusBadge({ status }) {
  const cls = {
    OPEN: "bg-blue-50 text-blue-700",
    IN_PROGRESS: "bg-indigo-50 text-indigo-700",
    COMPLETED: "bg-green-50 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }[status] || "bg-gray-100 text-gray-600";
  const label = { OPEN: "Open", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" }[status] || status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
