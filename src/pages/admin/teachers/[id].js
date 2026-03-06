import AdminLayout from "@/components/admin/AdminLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatType(type) {
  return String(type || "OTHER")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const RECORD_TYPE_CLASSES = {
  CERTIFICATE: "bg-emerald-50 text-emerald-800",
  ACHIEVEMENT: "bg-blue-50 text-blue-800",
  EMPLOYEE_OF_THE_MONTH: "bg-amber-50 text-amber-800",
  CAREER_LADDER: "bg-purple-50 text-purple-800",
};

export default function AdminTeacherDetail() {
  const router = useRouter();
  const teacherId = typeof router.query.id === "string" ? router.query.id : "";

  const [teacher, setTeacher] = useState(null);
  const [children, setChildren] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [records, setRecords] = useState([]);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordForm, setRecordForm] = useState({
    type: "CERTIFICATE",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    fileUrl: "",
    fileName: "",
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (!teacherId) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const user = await apiJson(`/api/v1/users/${encodeURIComponent(teacherId)}`);
        if (!user || user.role !== "TEACHER") {
          setError("User is not a teacher or was not found.");
          setTeacher(null);
          setLoading(false);
          return;
        }
        setTeacher(user);

        const centerIds = (user.centers || []).map((cu) => cu.centerId).filter(Boolean);

        const childPromises = centerIds.map((cid) =>
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(cid)}`).catch(() => []),
        );
        const childResults = await Promise.all(childPromises);
        const allChildren = childResults.flat().filter(Boolean);
        const unique = Object.values(
          Object.fromEntries(allChildren.map((c) => [c.id, c])),
        );
        unique.sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
        setChildren(unique);

        const actPromises = unique.slice(0, 20).map((c) =>
          apiJson(`/api/v1/activities?childId=${encodeURIComponent(c.id)}`)
            .then((list) =>
              (Array.isArray(list) ? list : [])
                .filter((a) => a.recordedById === teacherId || a.recordedBy?.id === teacherId)
                .map((a) => ({ ...a, childName: `${c.firstName || ""} ${c.lastName || ""}`.trim() })),
            )
            .catch(() => []),
        );
        const actResults = await Promise.all(actPromises);
        const allActs = actResults.flat();
        allActs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setActivities(allActs.slice(0, 30));

        const recs = await apiJson(
          `/api/v1/teacher-records?teacherId=${encodeURIComponent(teacherId)}`,
        ).catch(() => []);
        setRecords(Array.isArray(recs) ? recs : []);
      } catch (e) {
        setError(e.message || "Failed to load teacher");
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherId]);

  const centers = useMemo(() => {
    if (!teacher) return [];
    return (teacher.centers || []).map((cu) => ({
      id: cu.centerId,
      name: cu.center?.name || cu.centerId,
      role: cu.role,
    }));
  }, [teacher]);

  function resetRecordForm() {
    setRecordForm({
      type: "CERTIFICATE",
      title: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      fileUrl: "",
      fileName: "",
    });
  }

  function startEdit(record) {
    setEditingRecord(record);
    setRecordForm({
      type: record.type,
      title: record.title,
      description: record.description || "",
      date: record.date ? new Date(record.date).toISOString().slice(0, 10) : "",
      fileUrl: record.fileUrl || "",
      fileName: record.fileName || "",
    });
    setShowRecordForm(true);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({
          dataBase64: base64,
          filename: file.name,
          mimeType: file.type,
        }),
      });
      setRecordForm((prev) => ({ ...prev, fileUrl: result.url, fileName: result.originalName }));
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  }

  async function saveRecord() {
    setSavingRecord(true);
    setError("");
    try {
      if (editingRecord) {
        await apiJson(`/api/v1/teacher-records/${editingRecord.id}`, {
          method: "PUT",
          body: JSON.stringify(recordForm),
        });
      } else {
        await apiJson("/api/v1/teacher-records", {
          method: "POST",
          body: JSON.stringify({ ...recordForm, teacherId }),
        });
      }
      const recs = await apiJson(
        `/api/v1/teacher-records?teacherId=${encodeURIComponent(teacherId)}`,
      );
      setRecords(Array.isArray(recs) ? recs : []);
      setShowRecordForm(false);
      setEditingRecord(null);
      resetRecordForm();
    } catch (err) {
      setError(err.message || "Failed to save record");
    } finally {
      setSavingRecord(false);
    }
  }

  async function deleteRecord(recordId) {
    if (!confirm("Delete this record?")) return;
    try {
      await apiJson(`/api/v1/teacher-records/${recordId}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      setError(err.message || "Failed to delete record");
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Teacher Profile">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <Skeleton count={4} />
        </div>
      </AdminLayout>
    );
  }

  if (!teacher) {
    return (
      <AdminLayout title="Teacher Profile">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 no-underline hover:text-blue-700">
            &larr; Back to Users
          </Link>
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error || "Teacher not found."}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Teacher: ${teacher.name || teacher.email}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 no-underline hover:text-blue-700">
              &larr; Back to Users
            </Link>
            <Link href="/admin/teachers" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 no-underline hover:bg-gray-50">
              Teacher Assignments
            </Link>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          ) : null}
        </div>

        {/* Profile */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100">
              {teacher.pictureUrl ? (
                <img
                  src={teacher.pictureUrl}
                  alt={teacher.name || "Teacher"}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-[28px] font-extrabold text-sky-700">
                  {(teacher.name || teacher.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-[200px] flex-1">
              <h2 className="text-xl font-extrabold text-gray-900">
                {teacher.name || "Unnamed Teacher"}
              </h2>
              <div className="mt-1 text-sm text-gray-500">{teacher.email}</div>
              <div className="mt-1">
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  {teacher.role}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <InfoCard label="Date of Birth" value={formatDate(teacher.dob)} />
            <InfoCard label="Hire Date" value={formatDate(teacher.hireDate)} />
            <InfoCard label="Member Since" value={formatDate(teacher.createdAt)} />
            <InfoCard label="Centers" value={centers.length ? centers.map((c) => c.name).join(", ") : "None assigned"} />
          </div>

          {teacher.aboutMe ? (
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">About</div>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                {teacher.aboutMe}
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
          {/* Children */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-base font-extrabold text-gray-900">
              Children ({children.length})
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Children at assigned centers.
            </p>
            {children.length ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {children.slice(0, 30).map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/children/${encodeURIComponent(c.id)}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-2 no-underline transition hover:bg-sky-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-800">
                      {(c.firstName || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900">
                        {c.firstName || ""} {c.lastName || ""}
                      </div>
                      <div className="text-xs text-gray-500">
                        DOB: {formatDate(c.birthDate)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400">
                {centers.length
                  ? "No children found at assigned centers."
                  : "Assign this teacher to a center first to see children."}
              </p>
            )}
          </div>

          {/* Recent Activity Logs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-base font-extrabold text-gray-900">
              Recent Activity Logs
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Logs recorded by this teacher.
            </p>
            {activities.length ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {activities.map((a) => (
                  <div key={a.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2 transition hover:bg-sky-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                        {formatType(a.type)}
                      </span>
                      <span className="text-[11px] text-gray-400">{formatDateTime(a.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {a.childName ? <span className="font-semibold">{a.childName}</span> : null}
                      {a.notes ? <span> — {a.notes.length > 80 ? a.notes.slice(0, 80) + "…" : a.notes}</span> : null}
                      {!a.childName && !a.notes ? <span className="text-gray-400">No notes</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400">
                No activity logs found.
              </p>
            )}
          </div>
        </div>

        {/* Career Ladder Records */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Career Ladder Records ({records.length})
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Certificates, achievements, employee of the month, and career milestones.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              onClick={() => {
                setShowRecordForm(true);
                setEditingRecord(null);
                resetRecordForm();
              }}
            >
              + Add Record
            </button>
          </div>

          {showRecordForm ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-bold text-gray-900">
                {editingRecord ? "Edit Record" : "New Record"}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-gray-500">
                  Type
                  <select
                    value={recordForm.type}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="CERTIFICATE">Certificate</option>
                    <option value="ACHIEVEMENT">Achievement</option>
                    <option value="EMPLOYEE_OF_THE_MONTH">Employee of the Month</option>
                    <option value="CAREER_LADDER">Career Milestone</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-gray-500">
                  Date
                  <input
                    type="date"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="mt-3 block text-xs font-bold text-gray-500">
                Title
                <input
                  type="text"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g., CPR Certification, Employee of the Month - January"
                />
              </label>

              <label className="mt-3 block text-xs font-bold text-gray-500">
                Description
                <textarea
                  value={recordForm.description}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block min-h-[60px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Optional details..."
                />
              </label>

              {recordForm.type === "CERTIFICATE" ? (
                <div className="mt-3">
                  <div className="text-xs font-bold text-gray-500">Certificate File</div>
                  {recordForm.fileUrl ? (
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={recordForm.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {recordForm.fileName || "Uploaded file"}
                      </a>
                      <button
                        type="button"
                        className="border-none bg-transparent p-0 text-xs text-red-500 hover:text-red-700"
                        onClick={() => setRecordForm((prev) => ({ ...prev, fileUrl: "", fileName: "" }))}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="mt-1 text-sm"
                    />
                  )}
                  {uploadingFile ? (
                    <div className="mt-1 text-xs text-gray-500">Uploading...</div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={savingRecord || !recordForm.title}
                  onClick={saveRecord}
                >
                  {savingRecord ? "Saving..." : editingRecord ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => {
                    setShowRecordForm(false);
                    setEditingRecord(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {records.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {records.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2 transition hover:bg-sky-50/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${RECORD_TYPE_CLASSES[r.type] || RECORD_TYPE_CLASSES.CERTIFICATE}`}>
                        {formatType(r.type)}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{r.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-gray-400">{formatDate(r.date)}</span>
                      <button
                        type="button"
                        className="border-none bg-transparent p-0 text-xs font-bold text-blue-600 hover:text-blue-700"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="border-none bg-transparent p-0 text-xs font-bold text-red-500 hover:text-red-700"
                        onClick={() => deleteRecord(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {r.description ? (
                    <div className="mt-1 text-xs text-gray-700">{r.description}</div>
                  ) : null}
                  {r.fileUrl ? (
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-700"
                    >
                      View file: {r.fileName || "Download"}
                    </a>
                  ) : null}
                  {r.createdBy ? (
                    <div className="mt-1 text-[11px] text-gray-400">
                      Added by {r.createdBy.name || r.createdBy.email}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-400">
              No career ladder records yet. Click &quot;+ Add Record&quot; to add one.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-gray-900">{value}</div>
    </div>
  );
}
