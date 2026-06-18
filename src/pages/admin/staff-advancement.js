import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

function createStep() {
  return { stepIndex: "", title: "", description: "", resource: "", notes: "" };
}

function createForm() {
  return {
    title: "",
    description: "",
    category: "",
    media: "",
    sortOrder: "0",
    steps: [createStep()],
  };
}

export default function AdminStaffAdvancementPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [advancements, setAdvancements] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingAdvancements, setLoadingAdvancements] = useState(false);
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
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  const loadAdvancements = useCallback(async () => {
    if (!centerId) {
      setAdvancements([]);
      return;
    }
    setLoadingAdvancements(true);
    try {
      const data = await apiJson(
        `/api/v1/staff-advancement?centerId=${encodeURIComponent(centerId)}`,
      );
      setAdvancements(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load staff advancement records");
      setAdvancements([]);
    } finally {
      setLoadingAdvancements(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadAdvancements();
  }, [loadAdvancements]);

  const selectedCenterName = useMemo(
    () => centers.find((c) => c.id === centerId)?.name || "",
    [centerId, centers],
  );

  const categories = useMemo(() => {
    const set = new Set();
    for (const a of advancements) {
      if (a.category) set.add(a.category);
    }
    return [...set].sort();
  }, [advancements]);

  function resetForm() {
    setForm(createForm());
    setEditingId("");
  }

  function setStep(index, patch) {
    setForm((cur) => ({
      ...cur,
      steps: cur.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addStep() {
    setForm((cur) => ({
      ...cur,
      steps: [...cur.steps, { ...createStep(), stepIndex: String(cur.steps.length + 1) }],
    }));
  }

  function removeStep(index) {
    setForm((cur) => ({
      ...cur,
      steps:
        cur.steps.length === 1
          ? [createStep()]
          : cur.steps.filter((_, i) => i !== index),
    }));
  }

  function startEdit(adv) {
    setEditingId(adv.id);
    setForm({
      title: adv.title || "",
      description: adv.description || "",
      category: adv.category || "",
      media: Array.isArray(adv.media) ? adv.media.join("\n") : "",
      sortOrder: String(adv.sortOrder ?? 0),
      steps: Array.isArray(adv.steps) && adv.steps.length
        ? adv.steps.map((s) => ({
            stepIndex: String(s.stepIndex),
            title: s.title || "",
            description: s.description || "",
            resource: s.resource || "",
            notes: s.notes || "",
          }))
        : [createStep()],
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!centerId) {
      setError("Select a center first.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const mediaLines = form.media
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const payload = {
        centerId,
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        media: mediaLines,
        sortOrder: Number(form.sortOrder) || 0,
        steps: form.steps.map((s, i) => ({
          stepIndex: Number(s.stepIndex) || i + 1,
          title: s.title,
          description: s.description || null,
          resource: s.resource || null,
          notes: s.notes || null,
        })),
      };

      if (editingId) {
        await apiJson(`/api/v1/staff-advancement/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Staff advancement record updated.");
      } else {
        await apiJson("/api/v1/staff-advancement", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Staff advancement record created.");
      }

      resetForm();
      await loadAdvancements();
    } catch (e) {
      setError(e.message || "Failed to save staff advancement record");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAdvancement(id) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/staff-advancement/${id}`, { method: "DELETE" });
      setDeleteTarget(null);
      if (editingId === id) resetForm();
      setSuccess("Staff advancement record deleted.");
      await loadAdvancements();
    } catch (e) {
      setError(e.message || "Failed to delete staff advancement record");
      setDeleteTarget(null);
    }
  }

  return (
    <AdminLayout title="Staff Advancement">
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px" }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
                Staff Advancement
              </h1>
              <p style={{ margin: "8px 0 0", color: "#6b7280", maxWidth: 780 }}>
                Define staff advancement records with ordered steps of progression for teachers.
                These steps appear in the Training Pathway on the teacher-facing portal instead of children&apos;s steps of progression.
              </p>
            </div>
            <label style={{ minWidth: 260 }}>
              <div style={fieldLabelStyle}>Center</div>
              <select
                value={centerId}
                onChange={(e) => {
                  setCenterId(e.target.value);
                  resetForm();
                }}
                style={inputStyle}
                disabled={loadingCenters}
              >
                <option value="">Select a center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {error ? <Banner kind="error" message={error} /> : null}
          {success ? <Banner kind="success" message={success} /> : null}

          {!centerId ? (
            <Banner kind="info" message="Select a center to create or edit staff advancement records." />
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 18, marginTop: 18 }}>
            <form onSubmit={handleSubmit} style={{ ...cardStyle, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
                    {editingId ? "Edit record" : "New record"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                    {selectedCenterName || "Staff advancement"}
                  </div>
                </div>
                {editingId ? (
                  <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                    Clear edit
                  </button>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <label>
                  <div style={fieldLabelStyle}>Title</div>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                    style={inputStyle}
                    placeholder="e.g. New Teacher Orientation"
                    required
                    disabled={!centerId}
                  />
                </label>
                <label>
                  <div style={fieldLabelStyle}>Category</div>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    style={inputStyle}
                    placeholder="e.g. Onboarding, Curriculum, Safety"
                    list="category-suggestions"
                    disabled={!centerId}
                  />
                  <datalist id="category-suggestions">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </label>
              </div>

              <label style={{ display: "block", marginTop: 12 }}>
                <div style={fieldLabelStyle}>Description</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  placeholder="Brief overview of what this advancement covers."
                  disabled={!centerId}
                />
              </label>

              <label style={{ display: "block", marginTop: 12 }}>
                <div style={fieldLabelStyle}>Media links (one per line)</div>
                <textarea
                  value={form.media}
                  onChange={(e) => setForm((c) => ({ ...c, media: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 64, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                  placeholder={"https://example.com/video.mp4\nhttps://example.com/guide.pdf"}
                  disabled={!centerId}
                />
              </label>

              <label style={{ display: "block", marginTop: 12, maxWidth: 120 }}>
                <div style={fieldLabelStyle}>Sort order</div>
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm((c) => ({ ...c, sortOrder: e.target.value }))}
                  style={inputStyle}
                  disabled={!centerId}
                />
              </label>

              <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Steps of Progression</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                    Add ordered steps teachers should complete for this advancement.
                  </div>
                </div>
                <button type="button" onClick={addStep} style={secondaryButtonStyle} disabled={!centerId}>
                  + Add step
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {form.steps.map((step, index) => (
                  <div key={`step-${index}`} style={stepCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                        Step {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        style={dangerTextButtonStyle}
                        disabled={!centerId}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, marginTop: 10 }}>
                      <label>
                        <div style={fieldLabelStyle}>Step #</div>
                        <input
                          type="number"
                          min="1"
                          value={step.stepIndex}
                          onChange={(e) => setStep(index, { stepIndex: e.target.value })}
                          style={inputStyle}
                          disabled={!centerId}
                        />
                      </label>
                      <label>
                        <div style={fieldLabelStyle}>Step title</div>
                        <input
                          value={step.title}
                          onChange={(e) => setStep(index, { title: e.target.value })}
                          style={inputStyle}
                          placeholder="e.g. Complete safety training"
                          disabled={!centerId}
                        />
                      </label>
                    </div>

                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={fieldLabelStyle}>Testing criteria / description</div>
                      <textarea
                        value={step.description}
                        onChange={(e) => setStep(index, { description: e.target.value })}
                        style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        placeholder="How to verify this step is complete."
                        disabled={!centerId}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <label>
                        <div style={fieldLabelStyle}>Resource link</div>
                        <input
                          value={step.resource}
                          onChange={(e) => setStep(index, { resource: e.target.value })}
                          style={inputStyle}
                          placeholder="https://..."
                          disabled={!centerId}
                        />
                      </label>
                      <label>
                        <div style={fieldLabelStyle}>Notes</div>
                        <input
                          value={step.notes}
                          onChange={(e) => setStep(index, { notes: e.target.value })}
                          style={inputStyle}
                          placeholder="Optional admin notes"
                          disabled={!centerId}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                  Reset
                </button>
                <button type="submit" style={primaryButtonStyle} disabled={saving || !centerId}>
                  {saving ? "Saving..." : editingId ? "Update record" : "Create record"}
                </button>
              </div>
            </form>

            <div style={{ ...cardStyle, alignSelf: "start" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
                Existing records
              </div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                {selectedCenterName || "Select a center"}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                Staff advancement records for this center.
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {loadingAdvancements ? (
                  <Banner kind="info" message="Loading staff advancement records..." />
                ) : !centerId ? (
                  <Banner kind="info" message="Choose a center to review saved records." />
                ) : advancements.length === 0 ? (
                  <Banner kind="info" message="No staff advancement records have been created for this center yet." />
                ) : (
                  advancements.map((adv) => (
                    <div key={adv.id} style={stepCardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {adv.title}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                            {adv.category || "No category"} &middot; {(adv.steps || []).length} step{(adv.steps || []).length === 1 ? "" : "s"}
                            {adv.media?.length ? ` · ${adv.media.length} media` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button type="button" onClick={() => startEdit(adv)} style={secondaryButtonStyle}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(adv)} style={dangerTextButtonStyle}>
                            Delete
                          </button>
                        </div>
                      </div>
                      {adv.description ? (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                          {adv.description}
                        </div>
                      ) : null}
                      {(adv.steps || []).length ? (
                        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                          {adv.steps.map((step) => (
                            <div key={step.id} style={{ borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", padding: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                                Step {step.stepIndex}: {step.title}
                              </div>
                              {step.description ? (
                                <div style={{ marginTop: 3, fontSize: 11, color: "#4b5563", lineHeight: 1.4 }}>
                                  {step.description}
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
        title="Delete staff advancement record?"
        message={
          deleteTarget?.title
            ? `Delete "${deleteTarget.title}"? This removes the record and all of its steps.`
            : "Delete this staff advancement record?"
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteAdvancement(deleteTarget.id)}
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

const stepCardStyle = {
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
