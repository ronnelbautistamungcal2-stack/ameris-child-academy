import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "OTHER",
];

export default function TeacherLogs() {
  const router = useRouter();
  const initialCenterId =
    typeof router.query.centerId === "string" ? router.query.centerId : "";
  const initialChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";

  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [centerId, setCenterId] = useState(initialCenterId);
  const [childId, setChildId] = useState(initialChildId);
  const [type, setType] = useState("MEAL");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const c = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(c) ? c : []);
      if (!centerId && Array.isArray(c) && c.length === 1) {
        setCenterId(c[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadChildren(id) {
    if (!id) {
      setChildren([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kids = await apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`);
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSuccess("");
    loadChildren(centerId);
  }, [centerId]);

  const childLabel = useMemo(() => {
    const ch = children.find((c) => c.id === childId);
    if (!ch) return "";
    return `${ch.firstName}${ch.lastName ? ` ${ch.lastName}` : ""}`;
  }, [children, childId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify({ childId, type, notes }),
      });
      setNotes("");
      setSuccess(`Logged ${type} for ${childLabel || "child"}.`);
    } catch (e2) {
      setError(e2.message || "Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TeacherLayout title="Activity Logging">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Daily Activity Logging</h2>
        <p className="mt-1 text-sm text-gray-600">
          Teachers cannot backdate activity logs.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Child
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              disabled={!centerId || loading}
              required
            >
              <option value="">Select a child…</option>
              {children
                .slice()
                .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notes (optional)
            </div>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || !centerId || !childId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log Activity"}
            </button>
          </div>
        </form>
      </div>
    </TeacherLayout>
  );
}

