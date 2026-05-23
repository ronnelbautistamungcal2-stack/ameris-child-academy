import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { formatDateInputValue } from "@/lib/calendar";
import { useCallback, useEffect, useMemo, useState } from "react";

function createTopic() {
  return {
    title: "",
    description: "",
    resourceUrl: "",
    durationHours: "",
    required: true,
    notes: "",
  };
}

function createForm() {
  return {
    title: "",
    description: "",
    effectiveDate: formatDateInputValue(new Date()),
    active: true,
    topics: [createTopic()],
  };
}

export default function AdminTeacherTrainingPathwaysPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [pathways, setPathways] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingPathways, setLoadingPathways] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(createForm());

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoadingCenters(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load centers");
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  const loadPathways = useCallback(async () => {
    if (!centerId) {
      setPathways([]);
      return;
    }

    setLoadingPathways(true);
    try {
      const data = await apiJson(
        `/api/v1/teacher-training-pathways?centerId=${encodeURIComponent(centerId)}&includeInactive=1`,
      );
      setPathways(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load teacher training pathways");
      setPathways([]);
    } finally {
      setLoadingPathways(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadPathways();
  }, [loadPathways]);

  const selectedCenterName = useMemo(
    () => centers.find((center) => center.id === centerId)?.name || "",
    [centerId, centers],
  );

  function resetForm() {
    setForm(createForm());
    setEditingId("");
  }

  function setTopic(index, patch) {
    setForm((current) => ({
      ...current,
      topics: current.topics.map((topic, topicIndex) =>
        topicIndex === index ? { ...topic, ...patch } : topic,
      ),
    }));
  }

  function addTopic() {
    setForm((current) => ({
      ...current,
      topics: [...current.topics, createTopic()],
    }));
  }

  function removeTopic(index) {
    setForm((current) => ({
      ...current,
      topics:
        current.topics.length === 1
          ? [createTopic()]
          : current.topics.filter((_, topicIndex) => topicIndex !== index),
    }));
  }

  function startEdit(pathway) {
    setEditingId(pathway.id);
    setForm({
      title: pathway.title || "",
      description: pathway.description || "",
      effectiveDate: formatDateInputValue(pathway.effectiveDate, { allDay: true }),
      active: pathway.active !== false,
      topics: Array.isArray(pathway.topics) && pathway.topics.length
        ? pathway.topics.map((topic) => ({
            title: topic.title || "",
            description: topic.description || "",
            resourceUrl: topic.resourceUrl || "",
            durationHours:
              topic.durationHours === null || topic.durationHours === undefined
                ? ""
                : String(topic.durationHours),
            required: topic.required !== false,
            notes: topic.notes || "",
          }))
        : [createTopic()],
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!centerId) {
      setError("Select a center first.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        centerId,
        title: form.title,
        description: form.description || null,
        effectiveDate: form.effectiveDate,
        active: form.active,
        topics: form.topics.map((topic, index) => ({
          ...topic,
          sortOrder: index,
        })),
      };

      if (editingId) {
        await apiJson(`/api/v1/teacher-training-pathways/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Teacher training pathway updated.");
      } else {
        await apiJson("/api/v1/teacher-training-pathways", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Teacher training pathway created.");
      }

      resetForm();
      await loadPathways();
    } catch (nextError) {
      setError(nextError.message || "Failed to save teacher training pathway");
    } finally {
      setSaving(false);
    }
  }

  async function deletePathway(id) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/teacher-training-pathways/${id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      if (editingId === id) resetForm();
      setSuccess("Teacher training pathway deleted.");
      await loadPathways();
    } catch (nextError) {
      setError(nextError.message || "Failed to delete teacher training pathway");
      setDeleteTarget(null);
    }
  }

  return (
    <AdminLayout title="Teacher Training Pathways">
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px" }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
                Teacher Training Pathways
              </h1>
              <p style={{ margin: "8px 0 0", color: "#6b7280", maxWidth: 780 }}>
                Build a center-specific teacher training pathway without linking it to children&apos;s steps of progression.
                Add the ordered topics, notes, links, and estimated hours teachers should work through.
              </p>
            </div>
            <label style={{ minWidth: 260 }}>
              <div style={fieldLabelStyle}>Center</div>
              <select
                value={centerId}
                onChange={(event) => {
                  setCenterId(event.target.value);
                  resetForm();
                }}
                style={inputStyle}
                disabled={loadingCenters}
              >
                <option value="">Select a center...</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <Banner kind="error" message={error} /> : null}
          {success ? <Banner kind="success" message={success} /> : null}

          {!centerId ? (
            <Banner
              kind="info"
              message="Select a center to create or edit teacher training pathways."
            />
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 18, marginTop: 18 }}>
            <form onSubmit={handleSubmit} style={{ ...cardStyle, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
                    {editingId ? "Edit pathway" : "New pathway"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                    {selectedCenterName || "Teacher pathway"}
                  </div>
                </div>
                {editingId ? (
                  <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                    Clear edit
                  </button>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginTop: 16 }}>
                <label>
                  <div style={fieldLabelStyle}>Pathway title</div>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    style={inputStyle}
                    placeholder="New teacher onboarding"
                    required
                    disabled={!centerId}
                  />
                </label>
                <label>
                  <div style={fieldLabelStyle}>Effective date</div>
                  <input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
                    style={inputStyle}
                    required
                    disabled={!centerId}
                  />
                </label>
              </div>

              <label style={{ display: "block", marginTop: 12 }}>
                <div style={fieldLabelStyle}>Description</div>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                  placeholder="What this pathway covers and when staff should complete it."
                  disabled={!centerId}
                />
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, fontWeight: 700, color: "#374151" }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  disabled={!centerId}
                />
                Pathway is active for teachers
              </label>

              <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Topics</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                    Add the ordered training topics, links, and notes teachers should follow.
                  </div>
                </div>
                <button type="button" onClick={addTopic} style={secondaryButtonStyle} disabled={!centerId}>
                  + Add topic
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {form.topics.map((topic, index) => (
                  <div key={`topic-${index}`} style={topicCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                        Topic {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTopic(index)}
                        style={dangerTextButtonStyle}
                        disabled={!centerId}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, marginTop: 10 }}>
                      <label>
                        <div style={fieldLabelStyle}>Topic title</div>
                        <input
                          value={topic.title}
                          onChange={(event) => setTopic(index, { title: event.target.value })}
                          style={inputStyle}
                          placeholder="Health and safety orientation"
                          disabled={!centerId}
                        />
                      </label>
                      <label>
                        <div style={fieldLabelStyle}>Hours</div>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={topic.durationHours}
                          onChange={(event) => setTopic(index, { durationHours: event.target.value })}
                          style={inputStyle}
                          placeholder="1.5"
                          disabled={!centerId}
                        />
                      </label>
                    </div>

                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={fieldLabelStyle}>Description</div>
                      <textarea
                        value={topic.description}
                        onChange={(event) => setTopic(index, { description: event.target.value })}
                        style={{ ...inputStyle, minHeight: 74, resize: "vertical" }}
                        placeholder="What teachers need to understand or complete for this topic."
                        disabled={!centerId}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, marginTop: 10 }}>
                      <label>
                        <div style={fieldLabelStyle}>Resource link</div>
                        <input
                          value={topic.resourceUrl}
                          onChange={(event) => setTopic(index, { resourceUrl: event.target.value })}
                          style={inputStyle}
                          placeholder="https://..."
                          disabled={!centerId}
                        />
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, fontSize: 13, fontWeight: 700, color: "#374151" }}>
                        <input
                          type="checkbox"
                          checked={topic.required}
                          onChange={(event) => setTopic(index, { required: event.target.checked })}
                          disabled={!centerId}
                        />
                        Required
                      </label>
                    </div>

                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={fieldLabelStyle}>Notes</div>
                      <input
                        value={topic.notes}
                        onChange={(event) => setTopic(index, { notes: event.target.value })}
                        style={inputStyle}
                        placeholder="Optional reminders for admins or teachers"
                        disabled={!centerId}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                  Reset
                </button>
                <button type="submit" style={primaryButtonStyle} disabled={saving || !centerId}>
                  {saving ? "Saving..." : editingId ? "Update pathway" : "Create pathway"}
                </button>
              </div>
            </form>

            <div style={{ ...cardStyle, alignSelf: "start" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
                Existing pathways
              </div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                {selectedCenterName || "Select a center"}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                Active and inactive teacher training pathways for this center.
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {loadingPathways ? (
                  <Banner kind="info" message="Loading teacher training pathways..." />
                ) : !centerId ? (
                  <Banner kind="info" message="Choose a center to review saved pathways." />
                ) : pathways.length === 0 ? (
                  <Banner kind="info" message="No teacher training pathways have been created for this center yet." />
                ) : (
                  pathways.map((pathway) => (
                    <div key={pathway.id} style={topicCardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {pathway.title}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                            {formatDateInputValue(pathway.effectiveDate, { allDay: true })} | {pathway.active ? "Active" : "Inactive"} | {(pathway.topics || []).length} topic{(pathway.topics || []).length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={() => startEdit(pathway)} style={secondaryButtonStyle}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(pathway)} style={dangerTextButtonStyle}>
                            Delete
                          </button>
                        </div>
                      </div>
                      {pathway.description ? (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                          {pathway.description}
                        </div>
                      ) : null}
                      {(pathway.topics || []).length ? (
                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          {pathway.topics.map((topic) => (
                            <div key={topic.id} style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", padding: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                                  {topic.title}
                                </div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {topic.durationHours ? `${topic.durationHours}h` : "No hours"}
                                  {topic.required ? " | Required" : " | Optional"}
                                </div>
                              </div>
                              {topic.description ? (
                                <div style={{ marginTop: 4, fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>
                                  {topic.description}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete teacher training pathway?"
        message={
          deleteTarget?.title
            ? `Delete "${deleteTarget.title}"? This removes the pathway and all of its topics.`
            : "Delete this teacher training pathway?"
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deletePathway(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}

function Banner({ kind, message }) {
  const tone =
    kind === "error"
      ? { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }
      : kind === "success"
        ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }
        : { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };

  return (
    <div style={{ marginTop: 14, borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 600, ...tone }}>
      {message}
    </div>
  );
}

const panelStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#f9fafb",
};

const topicCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f3f4f6",
};

const fieldLabelStyle = {
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#6b7280",
};

const inputStyle = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerTextButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#dc2626",
  padding: 0,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
