import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const SUPPLY_CATEGORIES = ["General", "Art", "Science", "Craft", "Outdoor", "Music", "Math", "Other"];

export default function AdminSupplyLists() {
  const [centers, setCenters] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [supplyList, setSupplyList] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Manage supplies on individual lessons
  const [manageLessonId, setManageLessonId] = useState("");
  const [supplyRows, setSupplyRows] = useState([]);
  const [savingSupplies, setSavingSupplies] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(c) ? c : []);
        if (c.length) setCenterId(c[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadLessons = useCallback(async (cId) => {
    if (!cId) return;
    try {
      const data = await apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(cId)}`);
      setLessons(Array.isArray(data) ? data : []);
    } catch {
      setLessons([]);
    }
  }, []);

  const loadSupplyList = useCallback(async (cId) => {
    if (!cId) return;
    setSupplyLoading(true);
    try {
      const data = await apiJson(`/api/v1/lessons/supply-list?centerId=${encodeURIComponent(cId)}`);
      setSupplyList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load supply list");
    } finally {
      setSupplyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (centerId) {
      loadLessons(centerId);
      loadSupplyList(centerId);
    }
  }, [centerId, loadLessons, loadSupplyList]);

  const totalCost = useMemo(() => {
    return supplyList.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
  }, [supplyList]);

  const lessonsWithSupplies = useMemo(() => {
    return lessons.filter((l) => l.supplies && l.supplies.length > 0);
  }, [lessons]);

  function openManageSupplies(lesson) {
    setManageLessonId(lesson.id);
    setSupplyRows(
      (lesson.supplies || []).map((s) => ({
        name: s.name || "",
        quantity: s.quantity || 1,
        unit: s.unit || "",
        estimatedCost: s.estimatedCost || "",
        category: s.category || "General",
      })),
    );
    setError("");
    setSuccess("");
  }

  function addSupplyRow() {
    setSupplyRows((prev) => [...prev, { name: "", quantity: 1, unit: "", estimatedCost: "", category: "General" }]);
  }

  function removeSupplyRow(index) {
    setSupplyRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSupplyRow(index, field, value) {
    setSupplyRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveSupplies(e) {
    e.preventDefault();
    if (!manageLessonId) return;
    setSavingSupplies(true);
    setError("");
    setSuccess("");
    try {
      const validSupplies = supplyRows.filter((s) => s.name.trim());
      await apiJson(`/api/v1/lessons/${manageLessonId}`, {
        method: "PUT",
        body: JSON.stringify({ supplies: validSupplies }),
      });
      setSuccess("Supplies saved successfully.");
      setManageLessonId("");
      await loadLessons(centerId);
      await loadSupplyList(centerId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e2) {
      setError(e2.message || "Failed to save supplies");
    } finally {
      setSavingSupplies(false);
    }
  }

  function exportCsv() {
    if (!supplyList.length) return;
    const lines = ["Name,Quantity,Unit,Estimated Cost,Category,Lessons"];
    for (const s of supplyList) {
      const lessonNames = (s.lessons || []).map((l) => l.title).join("; ");
      lines.push(
        [
          csvEscape(s.name),
          s.totalQuantity,
          csvEscape(s.unit || ""),
          (s.estimatedCost || 0).toFixed(2),
          csvEscape(s.category || ""),
          csvEscape(lessonNames),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supply-list.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AdminLayout title="Supply Lists">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Supply Lists</h1>
              <p className="mt-1 text-sm text-gray-600">
                Consolidated supply lists auto-generated from lesson requirements.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Select center</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!supplyList.length}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
          ) : null}

          {loading || supplyLoading ? (
            <div className="mt-4 text-sm text-gray-600">Loading...</div>
          ) : supplyList.length === 0 ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No supplies found. Add supplies to lessons to generate a supply list.
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Items</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{supplyList.length}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Quantity</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{supplyList.reduce((s, i) => s + i.totalQuantity, 0)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimated Cost</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">${totalCost.toFixed(2)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lessons w/ Supplies</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{lessonsWithSupplies.length}</div>
                </div>
              </div>

              <div className="mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-3">Supply Name</th>
                      <th className="pb-2 pr-3">Qty</th>
                      <th className="pb-2 pr-3">Unit</th>
                      <th className="pb-2 pr-3">Est. Cost</th>
                      <th className="pb-2 pr-3">Category</th>
                      <th className="pb-2">Used In Lessons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplyList.map((s, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="py-2 pr-3">{s.totalQuantity}</td>
                        <td className="py-2 pr-3 text-gray-600">{s.unit || "—"}</td>
                        <td className="py-2 pr-3">${(s.estimatedCost || 0).toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{s.category}</span>
                        </td>
                        <td className="py-2 text-xs text-gray-600">
                          {(s.lessons || []).map((l) => l.title).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Manage supplies per lesson */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Manage Supplies per Lesson</h2>
          <p className="mt-1 text-sm text-gray-600">Select a lesson to add or edit its supply requirements.</p>

          {manageLessonId ? (
            <form onSubmit={saveSupplies} className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-extrabold text-gray-800">
                  Editing: {lessons.find((l) => l.id === manageLessonId)?.title || manageLessonId}
                </div>
                <button type="button" onClick={() => setManageLessonId("")} className="text-sm text-gray-500 hover:text-gray-800">
                  Cancel
                </button>
              </div>

              <div className="space-y-2">
                {supplyRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px_100px_120px_auto] gap-2 items-end">
                    <input
                      placeholder="Supply name"
                      value={row.name}
                      onChange={(e) => updateSupplyRow(idx, "name", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => updateSupplyRow(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Unit"
                      value={row.unit}
                      onChange={(e) => updateSupplyRow(idx, "unit", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cost"
                      value={row.estimatedCost}
                      onChange={(e) => updateSupplyRow(idx, "estimatedCost", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    />
                    <select
                      value={row.category}
                      onChange={(e) => updateSupplyRow(idx, "category", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    >
                      {SUPPLY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSupplyRow(idx)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-extrabold text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={addSupplyRow}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-extrabold text-gray-700 hover:bg-gray-50"
                >
                  + Add Supply
                </button>
                <button
                  type="submit"
                  disabled={savingSupplies}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSupplies ? "Saving..." : "Save Supplies"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lessons.slice(0, 50).map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => openManageSupplies(lesson)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:bg-gray-50"
                >
                  <div className="truncate text-sm font-extrabold text-gray-900">{lesson.title}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {lesson.supplies?.length
                      ? `${lesson.supplies.length} supply item${lesson.supplies.length > 1 ? "s" : ""}`
                      : "No supplies"}
                  </div>
                </button>
              ))}
              {lessons.length > 50 && (
                <div className="p-3 text-sm text-gray-500">Showing first 50 lessons. Use search to find specific lessons.</div>
              )}
              {lessons.length === 0 && (
                <div className="col-span-full text-sm text-gray-500">No lessons found for this center.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function csvEscape(val) {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
