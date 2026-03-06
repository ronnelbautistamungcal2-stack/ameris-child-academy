import CoachLayout from "@/components/coach/CoachLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function CoachObservations() {
  const router = useRouter();
  const { centerId: qCenterId, teacherId: qTeacherId } = router.query;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [observations, setObservations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("ALL");

  // Form state
  const [form, setForm] = useState({
    teacherId: "", type: "IN_CLASS", classRoomId: "", date: new Date().toISOString().slice(0, 10),
    duration: "", score: "", strengths: "", improvements: "", actionItems: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        const initial = qCenterId || (arr.length === 1 ? arr[0].id : "");
        setCenterId(initial);
      } catch {}
    })();
  }, [qCenterId]);

  useEffect(() => {
    if (qTeacherId) setForm((f) => ({ ...f, teacherId: qTeacherId }));
  }, [qTeacherId]);

  useEffect(() => {
    if (!centerId) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [obs, dashData] = await Promise.all([
          apiJson(`/api/v1/coach/observations?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setObservations(Array.isArray(obs) ? obs : []);
        setTeachers(dashData?.teachers || []);
        // Extract unique classrooms
        const crMap = new Map();
        for (const t of dashData?.teachers || []) {
          for (const cr of t.classrooms || []) {
            crMap.set(cr.id, cr);
          }
        }
        setClassrooms([...crMap.values()]);
      } catch (e) {
        setError(e.message || "Failed to load observations");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const filtered = filter === "ALL" ? observations : observations.filter((o) => o.type === filter);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teacherId || !centerId) return;
    setSaving(true);
    try {
      const created = await apiJson("/api/v1/coach/observations", {
        method: "POST",
        body: JSON.stringify({ ...form, centerId }),
      });
      setObservations((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({
        teacherId: "", type: "IN_CLASS", classRoomId: "", date: new Date().toISOString().slice(0, 10),
        duration: "", score: "", strengths: "", improvements: "", actionItems: "", notes: "",
      });
    } catch (e) {
      setError(e.message || "Failed to save observation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this observation?")) return;
    try {
      await apiJson(`/api/v1/coach/observations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setObservations((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  };

  return (
    <CoachLayout title="Observations">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Observations</h2>
            <p className="mt-1 text-sm text-gray-600">
              Camera observation & in-class observation follow-ups.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {centers.length > 1 && (
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="">Select center...</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700" disabled={!centerId}>
              {showForm ? "Cancel" : "+ New Observation"}
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {/* New Observation Form */}
        {showForm && centerId && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="font-extrabold text-gray-900">New Observation</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="IN_CLASS">In-class</option>
                  <option value="CAMERA">Camera</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Teacher</label>
                <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required>
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Classroom</label>
                <select value={form.classRoomId} onChange={(e) => setForm({ ...form, classRoomId: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Select classroom...</option>
                  {classrooms.map((cr) => <option key={cr.id} value={cr.id}>{cr.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Duration (min)</label>
                <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="e.g. 30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Score (0-5)</label>
                <input type="number" step="0.1" min="0" max="5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="e.g. 4.2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Strengths</label>
              <textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Areas for Improvement</label>
              <textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Action Items</label>
              <textarea value={form.actionItems} onChange={(e) => setForm({ ...form, actionItems: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
            </div>
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Observation"}
            </button>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {["ALL", "IN_CLASS", "CAMERA"].map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={[
              "rounded-full px-4 py-1.5 text-xs font-extrabold transition",
              filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}>
              {f === "ALL" ? "All" : f === "IN_CLASS" ? "In-class" : "Camera"}
            </button>
          ))}
        </div>

        {/* Observations List */}
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><SkeletonTable rows={5} cols={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No observations found.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((obs) => (
              <div key={obs.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-gray-900">{obs.teacher?.name || obs.teacher?.email}</span>
                      <span className={[
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        obs.type === "CAMERA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700",
                      ].join(" ")}>
                        {obs.type === "CAMERA" ? "Camera" : "In-class"}
                      </span>
                      {obs.score != null && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-700">
                          Score: {obs.score}/5
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {fmtDate(obs.date)}
                      {obs.classRoom ? ` — ${obs.classRoom.name}` : ""}
                      {obs.duration ? ` — ${obs.duration} min` : ""}
                      {obs.coach ? ` — by ${obs.coach.name || obs.coach.email}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDelete(obs.id)} className="text-xs font-semibold text-red-600 hover:text-red-700">
                    Delete
                  </button>
                </div>
                {(obs.strengths || obs.improvements || obs.actionItems || obs.notes) && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {obs.strengths && <Field label="Strengths" value={obs.strengths} color="text-emerald-700" />}
                    {obs.improvements && <Field label="Improvements" value={obs.improvements} color="text-amber-700" />}
                    {obs.actionItems && <Field label="Action Items" value={obs.actionItems} color="text-blue-700" />}
                    {obs.notes && <Field label="Notes" value={obs.notes} color="text-gray-700" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CoachLayout>
  );
}

function Field({ label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className={`text-xs font-extrabold ${color}`}>{label}</div>
      <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
