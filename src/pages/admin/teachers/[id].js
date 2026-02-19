import AdminLayout from "@/components/admin/AdminLayout";
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
        <div style={panelStyle}>
          <p style={{ color: "#6b7280" }}>Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!teacher) {
    return (
      <AdminLayout title="Teacher Profile">
        <div style={panelStyle}>
          <Link href="/admin/users" style={backLink}>
            &larr; Back to Users
          </Link>
          <div style={errorBannerStyle}>{error || "Teacher not found."}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Teacher: ${teacher.name || teacher.email}`}>
      <style>{`
        .teacher-child-row:hover { background: #f0f9ff; }
        .teacher-activity-row:hover { background: #f0f4f8; border-color: #e0e7ef; }
        .record-row:hover { background: #f8fafc; }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <Link href="/admin/users" style={backLink}>
              &larr; Back to Users
            </Link>
            <Link href="/admin/teachers" style={secondaryBtn}>
              Teacher Assignments
            </Link>
          </div>
          {error ? <div style={errorBannerStyle}>{error}</div> : null}
        </div>

        {/* Profile */}
        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
            <div style={avatarStyle}>
              {teacher.pictureUrl ? (
                <img
                  src={teacher.pictureUrl}
                  alt={teacher.name || "Teacher"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 800, color: "#0369a1" }}>
                  {(teacher.name || teacher.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                {teacher.name || "Unnamed Teacher"}
              </h2>
              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>{teacher.email}</div>
              <div style={{ marginTop: 4 }}>
                <span style={rolePill}>{teacher.role}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
            <InfoCard label="Date of Birth" value={formatDate(teacher.dob)} />
            <InfoCard label="Hire Date" value={formatDate(teacher.hireDate)} />
            <InfoCard label="Member Since" value={formatDate(teacher.createdAt)} />
            <InfoCard label="Centers" value={centers.length ? centers.map((c) => c.name).join(", ") : "None assigned"} />
          </div>

          {teacher.aboutMe ? (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel}>About</div>
              <p style={{ marginTop: 6, color: "#374151", fontSize: 14, lineHeight: 1.6 }}>
                {teacher.aboutMe}
              </p>
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          {/* Children */}
          <div style={panelStyle}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
              Children ({children.length})
            </h3>
            <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Children at assigned centers.
            </p>
            {children.length ? (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {children.slice(0, 30).map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/children/${encodeURIComponent(c.id)}`}
                    className="teacher-child-row"
                    style={childRow}
                  >
                    <div style={childAvatar}>
                      {(c.firstName || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {c.firstName || ""} {c.lastName || ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        DOB: {formatDate(c.birthDate)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", marginTop: 12, fontSize: 13 }}>
                {centers.length
                  ? "No children found at assigned centers."
                  : "Assign this teacher to a center first to see children."}
              </p>
            )}
          </div>

          {/* Recent Activity Logs */}
          <div style={panelStyle}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
              Recent Activity Logs
            </h3>
            <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Logs recorded by this teacher.
            </p>
            {activities.length ? (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {activities.map((a) => (
                  <div key={a.id} className="teacher-activity-row" style={activityRow}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={typePill}>{formatType(a.type)}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDateTime(a.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
                      {a.childName ? <span style={{ fontWeight: 600 }}>{a.childName}</span> : null}
                      {a.notes ? <span> — {a.notes.length > 80 ? a.notes.slice(0, 80) + "…" : a.notes}</span> : null}
                      {!a.childName && !a.notes ? <span style={{ color: "#9ca3af" }}>No notes</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", marginTop: 12, fontSize: 13 }}>
                No activity logs found.
              </p>
            )}
          </div>
        </div>

        {/* Career Ladder Records */}
        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
                Career Ladder Records ({records.length})
              </h3>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                Certificates, achievements, employee of the month, and career milestones.
              </p>
            </div>
            <button
              type="button"
              style={primaryBtn}
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
            <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                {editingRecord ? "Edit Record" : "New Record"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={formLabel}>
                  Type
                  <select
                    value={recordForm.type}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, type: e.target.value }))}
                    style={formInput}
                  >
                    <option value="CERTIFICATE">Certificate</option>
                    <option value="ACHIEVEMENT">Achievement</option>
                    <option value="EMPLOYEE_OF_THE_MONTH">Employee of the Month</option>
                    <option value="CAREER_LADDER">Career Milestone</option>
                  </select>
                </label>

                <label style={formLabel}>
                  Date
                  <input
                    type="date"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, date: e.target.value }))}
                    style={formInput}
                  />
                </label>
              </div>

              <label style={{ ...formLabel, marginTop: 12, display: "block" }}>
                Title
                <input
                  type="text"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={formInput}
                  placeholder="e.g., CPR Certification, Employee of the Month - January"
                />
              </label>

              <label style={{ ...formLabel, marginTop: 12, display: "block" }}>
                Description
                <textarea
                  value={recordForm.description}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ ...formInput, minHeight: 60 }}
                  placeholder="Optional details..."
                />
              </label>

              {recordForm.type === "CERTIFICATE" ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>Certificate File</div>
                  {recordForm.fileUrl ? (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <a
                        href={recordForm.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: "#2563eb" }}
                      >
                        {recordForm.fileName || "Uploaded file"}
                      </a>
                      <button
                        type="button"
                        style={{ fontSize: 12, color: "#ef4444", cursor: "pointer", background: "none", border: "none" }}
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
                      style={{ marginTop: 4, fontSize: 13 }}
                    />
                  )}
                  {uploadingFile ? (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Uploading...</div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  style={{
                    ...primaryBtn,
                    opacity: savingRecord || !recordForm.title ? 0.6 : 1,
                    cursor: savingRecord || !recordForm.title ? "not-allowed" : "pointer",
                  }}
                  disabled={savingRecord || !recordForm.title}
                  onClick={saveRecord}
                >
                  {savingRecord ? "Saving..." : editingRecord ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  style={secondaryBtn}
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
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {records.map((r) => (
                <div key={r.id} className="record-row" style={activityRow}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={recordTypePillStyle(r.type)}>{formatType(r.type)}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.title}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(r.date)}</span>
                      <button type="button" style={smallBtn} onClick={() => startEdit(r)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        style={{ ...smallBtn, color: "#ef4444" }}
                        onClick={() => deleteRecord(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {r.description ? (
                    <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{r.description}</div>
                  ) : null}
                  {r.fileUrl ? (
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 4, fontSize: 12, color: "#2563eb" }}
                    >
                      View file: {r.fileName || "Download"}
                    </a>
                  ) : null}
                  {r.createdBy ? (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                      Added by {r.createdBy.name || r.createdBy.email}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#9ca3af", marginTop: 12, fontSize: 13 }}>
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
    <div style={infoCardStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 14, color: "#111827" }}>{value}</div>
    </div>
  );
}

function formatType(type) {
  return String(type || "OTHER")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const RECORD_TYPE_COLORS = {
  CERTIFICATE: { bg: "#ecfdf5", color: "#065f46" },
  ACHIEVEMENT: { bg: "#eff6ff", color: "#1e40af" },
  EMPLOYEE_OF_THE_MONTH: { bg: "#fef3c7", color: "#92400e" },
  CAREER_LADDER: { bg: "#f3e8ff", color: "#6b21a8" },
};

function recordTypePillStyle(type) {
  const c = RECORD_TYPE_COLORS[type] || RECORD_TYPE_COLORS.CERTIFICATE;
  return {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 999,
    background: c.bg,
    color: c.color,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

const panelStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
};

const backLink = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#2563eb",
  textDecoration: "none",
};

const secondaryBtn = {
  display: "inline-block",
  padding: "8px 14px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

const primaryBtn = {
  display: "inline-block",
  padding: "8px 14px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const avatarStyle = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "#e0f2fe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
};

const rolePill = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  background: "#ecfdf5",
  color: "#065f46",
  fontSize: 12,
  fontWeight: 700,
};

const sectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b7280",
};

const infoCardStyle = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
};

const errorBannerStyle = {
  padding: 12,
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 8,
  marginTop: 12,
  border: "1px solid #fecaca",
};

const childRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 8,
  borderRadius: 8,
  border: "1px solid #f3f4f6",
  textDecoration: "none",
  transition: "background 0.1s",
};

const childAvatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#dbeafe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  color: "#1e40af",
  flexShrink: 0,
};

const activityRow = {
  padding: 8,
  borderRadius: 8,
  border: "1px solid #f3f4f6",
  background: "#f9fafb",
};

const typePill = {
  display: "inline-block",
  padding: "1px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1e40af",
  fontSize: 11,
  fontWeight: 700,
};

const formLabel = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
};

const formInput = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
};

const smallBtn = {
  background: "none",
  border: "none",
  fontSize: 12,
  fontWeight: 700,
  color: "#2563eb",
  cursor: "pointer",
  padding: 0,
};
