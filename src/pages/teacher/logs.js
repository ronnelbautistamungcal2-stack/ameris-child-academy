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

  const [mode, setMode] = useState("single"); // single | bulk
  const [bulkChildIds, setBulkChildIds] = useState([]);

  const [type, setType] = useState("MEAL");
  const [notes, setNotes] = useState("");
  const [dailyGrade, setDailyGrade] = useState("");

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
      const kids = await apiJson(
        `/api/v1/children?centerId=${encodeURIComponent(id)}`,
      );
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

  const sortedChildren = useMemo(() => {
    return children
      .slice()
      .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children]);

  const childLabel = useMemo(() => {
    const ch = children.find((c) => c.id === childId);
    if (!ch) return "";
    return `${ch.firstName}${ch.lastName ? ` ${ch.lastName}` : ""}`;
  }, [children, childId]);

  const bulkSelectedSet = useMemo(
    () => new Set(bulkChildIds || []),
    [bulkChildIds],
  );

  function toggleBulkChild(id, next) {
    setBulkChildIds((prev) => {
      const set = new Set(prev || []);
      if (next) set.add(id);
      else set.delete(id);
      return [...set];
    });
  }

  function selectAllBulk() {
    setBulkChildIds(sortedChildren.map((c) => c.id));
  }

  function clearBulk() {
    setBulkChildIds([]);
  }

  function buildPayload() {
    const gradeNum = dailyGrade === "" ? null : Number(dailyGrade);
    const hasGrade = dailyGrade !== "" && Number.isFinite(gradeNum);
    const payloadType = hasGrade ? "OTHER" : type;
    const details = hasGrade ? { kind: "DAILY_GRADE", grade: gradeNum } : null;
    return { payloadType, details };
  }

  async function submitSingle(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { payloadType, details } = buildPayload();
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify({ childId, type: payloadType, notes, details }),
      });
      setNotes("");
      setDailyGrade("");
      setSuccess(`Logged ${payloadType} for ${childLabel || "child"}.`);
    } catch (e2) {
      setError(e2.message || "Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk(e) {
    e.preventDefault();
    const ids = Array.isArray(bulkChildIds) ? bulkChildIds.filter(Boolean) : [];
    if (!ids.length) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { payloadType, details } = buildPayload();

      let ok = 0;
      const failures = [];
      for (const id of ids) {
        try {
          await apiJson("/api/v1/activities", {
            method: "POST",
            body: JSON.stringify({ childId: id, type: payloadType, notes, details }),
          });
          ok += 1;
        } catch (e2) {
          failures.push(e2?.message || `Failed for childId=${id}`);
        }
      }

      setNotes("");
      setDailyGrade("");
      setBulkChildIds([]);
      if (failures.length) {
        setError(
          `Bulk logging completed with errors (${ok}/${ids.length} succeeded): ${failures
            .slice(0, 3)
            .join(" • ")}`,
        );
      } else {
        setSuccess(`Bulk logged ${payloadType} for ${ok} children.`);
      }
    } catch (e2) {
      setError(e2.message || "Failed to bulk log activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TeacherLayout title="Activity Logging">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Daily Activity Logging</h2>
        <p className="mt-1 text-sm text-gray-600">
          Teachers cannot backdate activity logs. Bulk logging is supported.
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("single");
              setSuccess("");
              setError("");
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              mode === "single"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Single child
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("bulk");
              setSuccess("");
              setError("");
              setChildId("");
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              mode === "bulk"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Bulk logging
          </button>
        </div>

        <form
          onSubmit={mode === "bulk" ? submitBulk : submitSingle}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
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

          {mode === "single" ? (
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
                {sortedChildren.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:row-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Children (bulk)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllBulk}
                    disabled={!centerId || loading || saving || sortedChildren.length === 0}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearBulk}
                    disabled={saving || bulkChildIds.length === 0}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!centerId ? (
                <div className="mt-2 text-sm text-gray-600">Select a center first.</div>
              ) : sortedChildren.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">No children found.</div>
              ) : (
                <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
                  {sortedChildren.map((ch) => {
                    const checked = bulkSelectedSet.has(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-semibold text-gray-900">
                          {ch.firstName} {ch.lastName || ""}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleBulkChild(ch.id, e.target.checked)}
                          disabled={saving}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 text-xs text-gray-600">
                Selected: {bulkChildIds.length}
              </div>
            </div>
          )}

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
            <div className="mt-2 text-xs text-gray-600">
              Daily grade uses type <span className="font-semibold">OTHER</span> automatically.
            </div>
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

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Child daily grade (optional)
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={dailyGrade}
              onChange={(e) => setDailyGrade(e.target.value)}
            >
              <option value="">(not logging a grade)</option>
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={String(g)}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={
                saving ||
                !centerId ||
                (mode === "single" ? !childId : bulkChildIds.length === 0)
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "bulk" ? "Bulk Log Activity" : "Log Activity"}
            </button>
          </div>
        </form>
      </div>
    </TeacherLayout>
  );
}

