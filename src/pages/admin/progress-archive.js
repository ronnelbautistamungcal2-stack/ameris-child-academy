import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function currentSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // School year starts in August
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function ProgressArchive() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [archives, setArchives] = useState([]);

  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setChildren([]);
      setArchives([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [kids, arch] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/progress/archive?centerId=${encodeURIComponent(centerId)}&schoolYear=${encodeURIComponent(schoolYear)}`),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setArchives(Array.isArray(arch) ? arch : []);
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, schoolYear]);

  async function refreshArchives() {
    try {
      const arch = await apiJson(`/api/v1/progress/archive?centerId=${encodeURIComponent(centerId)}&schoolYear=${encodeURIComponent(schoolYear)}`);
      setArchives(Array.isArray(arch) ? arch : []);
    } catch {
      // silent
    }
  }

  async function createArchive(selectedChildId) {
    setArchiving(true);
    setError("");
    setSuccess("");
    try {
      const body = { centerId, schoolYear };
      if (selectedChildId) body.childId = selectedChildId;
      await apiJson("/api/v1/progress/archive", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(selectedChildId ? "Child progress archived successfully." : "All children archived successfully.");
      await refreshArchives();
    } catch (e) {
      setError(e.message || "Failed to archive");
    } finally {
      setArchiving(false);
    }
  }

  async function downloadArchive(archiveId, format) {
    try {
      const archive = await apiJson(`/api/v1/progress/archive/${encodeURIComponent(archiveId)}`);
      if (!archive?.data) throw new Error("No data in archive");

      let content, mimeType, ext;
      if (format === "csv") {
        const records = archive.data.progressRecords || [];
        const rows = [["Lesson", "Category", "Goal Index", "Goal Title", "Status", "Achieved At", "Notes"]];
        for (const r of records) {
          rows.push([
            r.lesson?.title || "",
            r.lesson?.category || "",
            String(r.goalIndex || ""),
            r.goalTitle || "",
            r.status || "",
            r.achievedAt || "",
            r.entries?.[0]?.notes || "",
          ]);
        }
        content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        mimeType = "text/csv";
        ext = "csv";
      } else {
        content = JSON.stringify(archive.data, null, 2);
        mimeType = "application/json";
        ext = "json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `progress-${archive.childName?.replace(/\s+/g, "-") || "archive"}-${archive.schoolYear}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Failed to download");
    }
  }

  async function deleteArchive(id) {
    if (!confirm("Delete this archive?")) return;
    try {
      await apiJson(`/api/v1/progress/archive/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshArchives();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  const schoolYearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) {
      years.push(`${y - 1}-${y}`);
    }
    return years;
  }, []);

  return (
    <AdminLayout title="Progress Archive">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Progress Archive</h2>
          <p className="mt-1 text-sm text-gray-600">
            Archive progress data across school years for record-keeping and transfer to other schools.
          </p>

          {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={loading}>
                <option value="">Select a center...</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">School Year</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}>
                {schoolYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Child (optional)</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={childId} onChange={(e) => setChildId(e.target.value)} disabled={!centerId}>
                <option value="">All children</option>
                {children.map((ch) => <option key={ch.id} value={ch.id}>{ch.firstName} {ch.lastName || ""}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={!centerId || archiving}
                onClick={() => createArchive(childId || null)}
              >
                {archiving ? "Archiving..." : childId ? "Archive Child" : "Archive All"}
              </button>
            </div>
          </div>
        </div>

        {/* Export buttons */}
        {centerId && children.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-extrabold text-gray-900">Quick Export</h3>
            <p className="mt-1 text-xs text-gray-500">Download current progress data for a child (without archiving).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {childId ? (
                <>
                  <a
                    href={`/api/v1/progress/export?childId=${encodeURIComponent(childId)}&format=json`}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    download
                  >
                    Download JSON
                  </a>
                  <a
                    href={`/api/v1/progress/export?childId=${encodeURIComponent(childId)}&format=csv`}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    download
                  >
                    Download CSV
                  </a>
                </>
              ) : (
                <div className="text-xs text-gray-500">Select a specific child above to export their data.</div>
              )}
            </div>
          </div>
        )}

        {/* Archives list */}
        {centerId && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-extrabold text-gray-900">
              Archived Records ({schoolYear})
            </h3>
            {loading ? (
              <div className="mt-3 text-sm text-gray-500">Loading...</div>
            ) : archives.length === 0 ? (
              <div className="mt-3 text-sm text-gray-500">No archives for this school year.</div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Child</th>
                      <th className="px-4 py-3">School Year</th>
                      <th className="px-4 py-3">Archived</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {archives.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{a.childName}</td>
                        <td className="px-4 py-3 text-gray-600">{a.schoolYear}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(a.archivedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700" onClick={() => downloadArchive(a.id, "json")}>JSON</button>
                            <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700" onClick={() => downloadArchive(a.id, "csv")}>CSV</button>
                            <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700" onClick={() => deleteArchive(a.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
