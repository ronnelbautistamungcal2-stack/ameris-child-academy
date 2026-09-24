import {
  FORM_ASSIGNMENT_TYPES,
  STAFF_ROLE_OPTIONS,
  describeAssignment,
  formatAgeMonths,
  normalizeAssignmentType,
  normalizeStaffRoles,
} from "@/lib/formAssignments";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function SvgIcon({ children, size = 18, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const IconPlus = (p) => (
  <SvgIcon {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </SvgIcon>
);

const IconPaperclip = (p) => (
  <SvgIcon {...p}>
    <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </SvgIcon>
);

const IconTrash = (p) => (
  <SvgIcon {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </SvgIcon>
);

const IconPencil = (p) => (
  <SvgIcon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </SvgIcon>
);

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgIcon>
);

const IconX = (p) => (
  <SvgIcon {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </SvgIcon>
);

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const EMPTY_DRAFT = {
  id: "",
  title: "",
  description: "",
  assignmentType: "FAMILY",
  ageMinYears: "",
  ageMinMonths: "",
  ageMaxYears: "",
  ageMaxMonths: "",
  staffRoles: [],
  centerId: "",
  active: true,
  requiresRenewal: false,
  renewalPeriodDays: "",
  dueDate: "",
  attachmentUrl: "",
  attachmentName: "",
  attachmentSize: null,
};

/** <input type="date"> wants YYYY-MM-DD, the API hands back an ISO timestamp. */
function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function splitMonths(total) {
  if (total === null || total === undefined) return { years: "", months: "" };
  const value = Number(total);
  if (!Number.isFinite(value) || value < 0) return { years: "", months: "" };
  return { years: String(Math.floor(value / 12)), months: String(value % 12) };
}

function joinMonths(years, months) {
  const y = years === "" ? null : Number.parseInt(years, 10);
  const m = months === "" ? null : Number.parseInt(months, 10);
  if (y === null && m === null) return null;
  const total = (Number.isFinite(y) ? y : 0) * 12 + (Number.isFinite(m) ? m : 0);
  return total >= 0 ? total : null;
}

function draftFromTemplate(template) {
  const min = splitMonths(template.ageMinMonths);
  const max = splitMonths(template.ageMaxMonths);
  return {
    id: template.id,
    title: template.title || "",
    description: template.description || "",
    assignmentType: normalizeAssignmentType(template.assignmentType),
    ageMinYears: min.years,
    ageMinMonths: min.months,
    ageMaxYears: max.years,
    ageMaxMonths: max.months,
    staffRoles: normalizeStaffRoles(template.staffRoles),
    centerId: template.centerId || "",
    active: template.active !== false,
    requiresRenewal: !!template.requiresRenewal,
    renewalPeriodDays: template.renewalPeriodDays ? String(template.renewalPeriodDays) : "",
    dueDate: toDateInput(template.dueDate),
    attachmentUrl: template.attachmentUrl || "",
    attachmentName: template.attachmentName || "",
    attachmentSize: template.attachmentSize ?? null,
  };
}

export default function FormLibraryPanel({ onError, onSuccess }) {
  const [templates, setTemplates] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const fileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/centers").catch(() => []),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      onError?.(e.message || "Failed to load the form library");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const byType = { FAMILY: 0, CHILD: 0, AGE_GROUP: 0, STAFF: 0 };
    for (const t of templates) byType[normalizeAssignmentType(t.assignmentType)] += 1;
    return byType;
  }, [templates]);

  const visible = useMemo(() => {
    const list =
      assignmentFilter === "all"
        ? templates
        : templates.filter((t) => normalizeAssignmentType(t.assignmentType) === assignmentFilter);
    return [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [templates, assignmentFilter]);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  function openEdit(template) {
    setDraft(draftFromTemplate(template));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setDraft(EMPTY_DRAFT);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function patchDraft(changes) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function toggleStaffRole(role) {
    setDraft((current) => ({
      ...current,
      staffRoles: current.staffRoles.includes(role)
        ? current.staffRoles.filter((r) => r !== role)
        : [...current.staffRoles, role],
    }));
  }

  async function handleAttach(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      onError?.("Attachments must be 25MB or smaller.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    onError?.("");
    try {
      const base64 = await readFileAsBase64(file);
      const result = await apiJson("/api/v1/upload", {
        method: "POST",
        body: JSON.stringify({ file: base64, fileName: file.name }),
      });
      patchDraft({
        attachmentUrl: result.url,
        attachmentName: file.name,
        attachmentSize: file.size,
      });
    } catch (e) {
      onError?.(e.message || "Failed to attach that file");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!draft.title.trim()) {
      onError?.("Give the form a title.");
      return;
    }
    if (draft.assignmentType === "STAFF" && draft.staffRoles.length === 0) {
      onError?.("Choose at least one staff role to assign this form to.");
      return;
    }

    setSaving(true);
    onError?.("");
    onSuccess?.("");
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        assignmentType: draft.assignmentType,
        ageMinMonths:
          draft.assignmentType === "AGE_GROUP"
            ? joinMonths(draft.ageMinYears, draft.ageMinMonths)
            : null,
        ageMaxMonths:
          draft.assignmentType === "AGE_GROUP"
            ? joinMonths(draft.ageMaxYears, draft.ageMaxMonths)
            : null,
        staffRoles: draft.assignmentType === "STAFF" ? draft.staffRoles : [],
        centerId: draft.centerId || null,
        active: draft.active,
        requiresRenewal: draft.requiresRenewal,
        renewalPeriodDays: draft.requiresRenewal ? draft.renewalPeriodDays || null : null,
        dueDate: draft.dueDate || null,
        attachmentUrl: draft.attachmentUrl || null,
        attachmentName: draft.attachmentName || null,
        attachmentSize: draft.attachmentSize ?? null,
      };

      if (draft.id) {
        await apiJson(`/api/v1/forms/templates/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSuccess?.(`${payload.title} updated.`);
      } else {
        await apiJson("/api/v1/forms/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSuccess?.(`${payload.title} added to the form library.`);
      }
      closeEditor();
      await refresh();
    } catch (e) {
      onError?.(e.message || "Failed to save the form");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(template) {
    onError?.("");
    onSuccess?.("");
    try {
      await apiJson(`/api/v1/forms/templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !template.active }),
      });
      onSuccess?.(`${template.title} ${template.active ? "deactivated" : "activated"}.`);
      await refresh();
    } catch (e) {
      onError?.(e.message || "Failed to update the form");
    }
  }

  async function remove(template) {
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Delete "${template.title}"? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(template.id);
    onError?.("");
    onSuccess?.("");
    try {
      await apiJson(`/api/v1/forms/templates/${template.id}`, { method: "DELETE" });
      onSuccess?.(`${template.title} deleted.`);
      await refresh();
    } catch (e) {
      onError?.(e.message || "Failed to delete the form");
    } finally {
      setDeletingId("");
    }
  }

  const filterTabs = [
    { key: "all", label: "All forms", count: templates.length },
    ...FORM_ASSIGNMENT_TYPES.map((t) => ({ key: t.value, label: t.label, count: counts[t.value] })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--admin-text)" }}>
            Form Library
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--admin-text-muted)" }}>
            Add a form, attach the document that has to be completed, and choose who it is assigned to.
          </p>
        </div>
        <button type="button" onClick={openCreate} style={primaryButton}>
          <IconPlus size={16} /> Add Form
        </button>
      </div>

      {/* ── Editor ─────────────────────────────────── */}
      {editorOpen ? (
        <form onSubmit={save} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--admin-text)" }}>
              {draft.id ? "Edit form" : "New form"}
            </div>
            <button type="button" onClick={closeEditor} style={iconButton} title="Cancel">
              <IconX size={16} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            <Field label="Form title" required>
              <input
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
                placeholder="e.g. Health Information Form"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Center">
              <select
                value={draft.centerId}
                onChange={(e) => patchDraft({ centerId: e.target.value })}
                style={inputStyle}
              >
                <option value="">All centers</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label="Description">
              <input
                value={draft.description}
                onChange={(e) => patchDraft({ description: e.target.value })}
                placeholder="Shown to whoever has to complete the form"
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Attachment */}
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>Attached document</div>
            {draft.attachmentUrl ? (
              <div style={attachmentRow}>
                <IconPaperclip size={16} />
                <a
                  href={draft.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    color: "#2563eb",
                    fontWeight: 600,
                    fontSize: 13,
                    wordBreak: "break-all",
                  }}
                >
                  {draft.attachmentName || draft.attachmentUrl}
                </a>
                {draft.attachmentSize ? (
                  <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                    {formatBytes(draft.attachmentSize)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    patchDraft({ attachmentUrl: "", attachmentName: "", attachmentSize: null })
                  }
                  style={iconButton}
                  title="Remove attachment"
                >
                  <IconX size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleAttach}
                  disabled={uploading}
                  style={{ fontSize: 13, color: "var(--admin-text-secondary)" }}
                />
                <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                  {uploading ? "Uploading…" : "PDF, image, or document up to 25MB. Optional."}
                </span>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div style={{ marginTop: 16 }}>
            <div style={labelStyle}>Assign this form to</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 10,
              }}
            >
              {FORM_ASSIGNMENT_TYPES.map((option) => {
                const selected = draft.assignmentType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => patchDraft({ assignmentType: option.value })}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${selected ? "#2563eb" : "var(--admin-border)"}`,
                      background: selected ? "var(--admin-accent-bg)" : "var(--admin-bg)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          border: `4px solid ${selected ? "#2563eb" : "var(--admin-border)"}`,
                          background: "var(--admin-bg)",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                        {option.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--admin-text-muted)",
                        marginTop: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {draft.assignmentType === "AGE_GROUP" ? (
            <div style={subPanel}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)" }}>
                Age range
              </div>
              <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
                Leave a side blank for an open-ended range.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <AgeInput
                  label="From"
                  years={draft.ageMinYears}
                  months={draft.ageMinMonths}
                  onYears={(v) => patchDraft({ ageMinYears: v })}
                  onMonths={(v) => patchDraft({ ageMinMonths: v })}
                />
                <AgeInput
                  label="To"
                  years={draft.ageMaxYears}
                  months={draft.ageMaxMonths}
                  onYears={(v) => patchDraft({ ageMaxYears: v })}
                  onMonths={(v) => patchDraft({ ageMaxMonths: v })}
                />
              </div>
            </div>
          ) : null}

          {draft.assignmentType === "STAFF" ? (
            <div style={subPanel}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)" }}>
                Staff roles
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {STAFF_ROLE_OPTIONS.map((role) => {
                  const selected = draft.staffRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleStaffRole(role.value)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: `1px solid ${selected ? "#2563eb" : "var(--admin-border)"}`,
                        background: selected ? "#2563eb" : "var(--admin-bg)",
                        color: selected ? "white" : "var(--admin-text-secondary)",
                      }}
                    >
                      <IconUsers size={13} /> {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Renewal + status */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            <Field label="Requires renewal">
              <select
                value={draft.requiresRenewal ? "true" : "false"}
                onChange={(e) => patchDraft({ requiresRenewal: e.target.value === "true" })}
                style={inputStyle}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
            {draft.requiresRenewal ? (
              <Field label="Renewal period (days)">
                <input
                  type="number"
                  min="1"
                  value={draft.renewalPeriodDays}
                  onChange={(e) => patchDraft({ renewalPeriodDays: e.target.value })}
                  placeholder="365"
                  style={inputStyle}
                />
              </Field>
            ) : null}
            <Field label="Due date">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => patchDraft({ dueDate: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Status">
              <select
                value={draft.active ? "true" : "false"}
                onChange={(e) => patchDraft({ active: e.target.value === "true" })}
                style={inputStyle}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="submit" disabled={saving || uploading} style={primaryButton}>
              {saving ? "Saving…" : draft.id ? "Save changes" : "Add form"}
            </button>
            <button type="button" onClick={closeEditor} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Assignment filter ──────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--admin-bg-secondary)",
          borderRadius: 8,
          padding: 3,
          flexWrap: "wrap",
        }}
      >
        {filterTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setAssignmentFilter(t.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              background: assignmentFilter === t.key ? "var(--admin-bg)" : "transparent",
              color: assignmentFilter === t.key ? "var(--admin-text)" : "var(--admin-text-muted)",
              boxShadow: assignmentFilter === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t.label}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: assignmentFilter === t.key ? "#2563eb" : "var(--admin-bg-tertiary)",
                color: assignmentFilter === t.key ? "white" : "var(--admin-text-muted)",
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Template list ──────────────────────────── */}
      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 88,
                borderRadius: 12,
                background: "var(--admin-bg-tertiary)",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text-secondary)" }}>
            No forms here yet
          </div>
          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
            {assignmentFilter === "all"
              ? "Use Add Form to create your first form and choose who it goes to."
              : "No forms are assigned to this group yet."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visible.map((template) => (
            <div key={template.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--admin-text)" }}>
                      {template.title}
                    </span>
                    <span style={pill(template.active)}>
                      {template.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 4 }}>
                    {template.description || "No description."}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={tag}>{describeAssignment(template)}</span>
                    <span style={tag}>
                      Center: {centers.find((c) => c.id === template.centerId)?.name || "All centers"}
                    </span>
                    {template.dueDate ? (
                      <span style={tag}>Due {new Date(template.dueDate).toLocaleDateString()}</span>
                    ) : null}
                    {template.requiresRenewal ? (
                      <span style={tag}>Renews every {template.renewalPeriodDays || "?"} days</span>
                    ) : null}
                  </div>
                  {template.attachmentUrl ? (
                    <a
                      href={template.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#2563eb",
                        textDecoration: "none",
                      }}
                    >
                      <IconPaperclip size={14} />
                      {template.attachmentName || "Attached document"}
                      {template.attachmentSize ? ` (${formatBytes(template.attachmentSize)})` : ""}
                    </a>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <button type="button" onClick={() => openEdit(template)} style={secondaryButton}>
                    <IconPencil size={14} /> Edit
                  </button>
                  <button type="button" onClick={() => toggleActive(template)} style={secondaryButton}>
                    {template.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(template)}
                    disabled={deletingId === template.id}
                    style={{ ...secondaryButton, color: "var(--admin-error-text)" }}
                    title="Delete form"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgeInput({ label, years, months, onYears, onMonths }) {
  const total = joinMonths(years, months);
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          min="0"
          value={years}
          onChange={(e) => onYears(e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>years</span>
        <input
          type="number"
          min="0"
          max="11"
          value={months}
          onChange={(e) => onMonths(e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>months</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 4, minHeight: 14 }}>
        {total === null ? "Open ended" : formatAgeMonths(total)}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={labelStyle}>
        {label}
        {required ? <span style={{ color: "var(--admin-error-text)" }}> *</span> : null}
      </div>
      {children}
    </label>
  );
}

/* ── shared inline styles ─────────────────────────────────── */

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  boxSizing: "border-box",
};

const cardStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 16,
};

const subPanel = {
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  background: "var(--admin-bg-secondary)",
  border: "1px solid var(--admin-border-light)",
};

const attachmentRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--admin-border-light)",
  background: "var(--admin-bg-secondary)",
  color: "var(--admin-text-muted)",
};

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 16px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  background: "var(--admin-bg)",
  color: "var(--admin-text-secondary)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const iconButton = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--admin-text-muted)",
  padding: 4,
  display: "inline-flex",
};

const tag = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 999,
  background: "var(--admin-bg-tertiary)",
  color: "var(--admin-text-secondary)",
  border: "1px solid var(--admin-border-light)",
};

function pill(active) {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    background: active ? "var(--admin-success-bg)" : "var(--admin-bg-tertiary)",
    color: active ? "var(--admin-success-text)" : "var(--admin-text-muted)",
    border: `1px solid ${active ? "var(--admin-success-border)" : "var(--admin-border)"}`,
  };
}
