import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentField,
  ParentPageHeader,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ParentForms() {
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [children, setChildren] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [childId, setChildId] = useState("");
  const [formValues, setFormValues] = useState({});
  const [rawMode, setRawMode] = useState(false);
  const [rawDataText, setRawDataText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeRenewalId, setActiveRenewalId] = useState("");
  const formSectionRef = useRef(null);
  const pendingDraftRef = useRef(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [t, s, kids] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/forms/submissions"),
        apiJson("/api/v1/children"),
      ]);
      const templateList = Array.isArray(t) ? t : [];
      const childList = Array.isArray(kids) ? kids : [];
      setTemplates(templateList);
      setSubmissions(Array.isArray(s) ? s : []);
      setChildren(childList);
      setTemplateId((current) => current || templateList[0]?.id || "");
      setChildId((current) => current || childList[0]?.id || "");
    } catch (e) {
      setError(e.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    [templates],
  );

  const selectedTemplate = useMemo(
    () => sortedTemplates.find((t) => t.id === templateId) || null,
    [sortedTemplates, templateId],
  );

  const selectedChild = useMemo(
    () => children.find((child) => child.id === childId) || null,
    [children, childId],
  );

  const selectedTemplateFields = useMemo(
    () => normalizeTemplateFields(selectedTemplate?.schema),
    [selectedTemplate?.schema],
  );

  useEffect(() => {
    const pendingDraft = pendingDraftRef.current;
    const draftData =
      pendingDraft && pendingDraft.templateId === selectedTemplate?.id
        ? pendingDraft.data
        : null;

    setFormValues(buildInitialFormValues(selectedTemplateFields, draftData));
    setRawDataText(formatJsonText(draftData));
    setRawMode(selectedTemplateFields.length === 0);
    setActiveRenewalId(
      pendingDraft && pendingDraft.templateId === selectedTemplate?.id
        ? pendingDraft.submissionId || ""
        : "",
    );

    if (pendingDraft && pendingDraft.templateId === selectedTemplate?.id) {
      pendingDraftRef.current = null;
    }
  }, [selectedTemplate?.id, selectedTemplateFields]);

  const submissionStats = useMemo(() => {
    const total = submissions.length;
    const approved = submissions.filter((item) => item.status === "APPROVED").length;
    const pending = submissions.filter((item) => item.status === "PENDING").length;
    const expiringSoon = submissions.filter((item) => {
      if (!item.expiresAt) return false;
      const expiresAt = new Date(item.expiresAt).getTime();
      return expiresAt >= Date.now() && expiresAt <= Date.now() + 30 * 86400000;
    }).length;
    return { total, approved, pending, expiringSoon };
  }, [submissions]);

  const renewalQueue = useMemo(
    () =>
      submissions.filter((item) => {
        if (!item.expiresAt) return false;
        return new Date(item.expiresAt).getTime() <= Date.now() + 30 * 86400000;
      }).length,
    [submissions],
  );

  const draftState = useMemo(
    () =>
      buildDraftState({
        fields: selectedTemplateFields,
        values: formValues,
        rawMode,
        rawText: rawDataText,
      }),
    [selectedTemplateFields, formValues, rawMode, rawDataText],
  );

  function hydrateDraftFromSubmission(submission) {
    pendingDraftRef.current = {
      templateId: submission.templateId,
      submissionId: submission.id,
      data: submission.data ?? null,
    };
    setTemplateId(submission.templateId);
    setChildId(submission.childId || "");
    setSuccess(
      `Renewal draft loaded for ${submission.template?.title || "this form"}. Review and submit when ready.`,
    );
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRawModeChange(nextMode) {
    if (nextMode) {
      setRawDataText(formatJsonText(draftState.data));
      setRawMode(true);
      return;
    }

    const nextValues =
      draftState.data && typeof draftState.data === "object" && !Array.isArray(draftState.data)
        ? buildInitialFormValues(selectedTemplateFields, draftState.data)
        : buildInitialFormValues(selectedTemplateFields);
    setFormValues(nextValues);
    setRawMode(false);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!templateId) throw new Error("Please choose a form template first.");
      if (draftState.errors.length > 0) throw new Error(draftState.errors[0]);
      await apiJson("/api/v1/forms/submissions", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          childId: childId || null,
          data: draftState.hasAnyData ? draftState.data : null,
        }),
      });
      setFormValues(buildInitialFormValues(selectedTemplateFields));
      setRawDataText("");
      setRawMode(selectedTemplateFields.length === 0);
      setActiveRenewalId("");
      setSuccess("Form submitted successfully.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to submit form");
    } finally {
      setSaving(false);
    }
  }

  const draftSummary = summarizeSubmissionData(draftState.data);

  return (
    <ParentLayout title="Forms & Renewals">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Forms center"
          title="Complete and track family paperwork"
          description="Review submission status, renew expiring documents, and send updated details to the center without hunting through multiple screens."
          accent="emerald"
          layout="split"
          stats={[
            { label: "Submitted", value: submissionStats.total, hint: "Total form records", tone: "sky" },
            { label: "Pending", value: submissionStats.pending, hint: "Awaiting review", tone: submissionStats.pending ? "amber" : "gray" },
            { label: "Approved", value: submissionStats.approved, hint: "Already accepted", tone: "emerald" },
            { label: "Renew Soon", value: submissionStats.expiringSoon, hint: "Within 30 days", tone: submissionStats.expiringSoon ? "rose" : "gray" },
          ]}
          actions={<ParentButton variant="secondary" onClick={refresh}>Refresh forms</ParentButton>}
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}
        {success ? (
          <ParentSurface className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {success}
          </ParentSurface>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ParentSection
            title="Submission timeline"
            description="See what has already been filed, which answers were sent, and jump back into items that need renewal."
            className="bg-gradient-to-br from-white via-emerald-50/40 to-white"
            action={
              <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                {renewalQueue ? `${renewalQueue} renewal item${renewalQueue === 1 ? "" : "s"}` : "No urgent renewals"}
              </div>
            }
          >
            {loading ? (
              <Skeleton count={4} />
            ) : submissions.length === 0 ? (
              <ParentEmpty
                title="No forms submitted yet"
                description="Choose a template on the right to send your first form."
              />
            ) : (
              <div className="space-y-3">
                {submissions
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .slice(0, 20)
                  .map((submission) => {
                    const isExpired =
                      submission.expiresAt && new Date(submission.expiresAt) < new Date();
                    const isExpiringSoon =
                      submission.expiresAt &&
                      !isExpired &&
                      new Date(submission.expiresAt) <= new Date(Date.now() + 30 * 86400000);
                    const dataSummary = summarizeSubmissionData(submission.data);
                    return (
                      <div
                        key={submission.id}
                        className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                              {submission.template?.title || "Form"}
                            </div>
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              Submitted {formatDateTime(submission.createdAt)}
                            </div>
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              Child: {submission.child ? `${submission.child.firstName} ${submission.child.lastName || ""}` : "Not linked to a child"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                              {submission.status}
                            </span>
                            {submission.expiresAt ? (
                              <span
                                className={[
                                  "rounded-full px-3 py-1 text-xs font-extrabold",
                                  isExpired
                                    ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
                                    : isExpiringSoon
                                      ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                      : "border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
                                ].join(" ")}
                              >
                                {isExpired ? "Expired" : `Expires ${formatDate(submission.expiresAt)}`}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {dataSummary.length ? (
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {dataSummary.map((item) => (
                              <div
                                key={`${submission.id}-${item.label}`}
                                className="rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2"
                              >
                                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                                  {item.label}
                                </div>
                                <div className="mt-1 text-sm text-gray-700">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-500">
                            No additional answers were included with this submission.
                          </div>
                        )}

                        {(isExpired || isExpiringSoon) ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <ParentButton
                              type="button"
                              variant="soft"
                              onClick={() => hydrateDraftFromSubmission(submission)}
                            >
                              Renew this form
                            </ParentButton>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </ParentSection>

          <div ref={formSectionRef}>
            <ParentSection
              title="Submit a new form"
              description="Pick the form, choose the child it belongs to, and complete a guided form when the template includes field definitions."
              className="relative overflow-hidden bg-gradient-to-br from-white via-white to-cyan-50/40"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/20" />
              <form onSubmit={submit} className="space-y-4">
                <ParentField label="Template">
                  <select
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      setSuccess("");
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                  >
                    <option value="">Select a template</option>
                    {sortedTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </ParentField>

                <ParentField label="Child">
                  <select
                    value={childId}
                    onChange={(e) => setChildId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                  >
                    <option value="">No child selected</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.firstName} {child.lastName || ""}
                      </option>
                    ))}
                  </select>
                </ParentField>

                <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                        Submission preview
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div>Form: {selectedTemplate?.title || "Choose a template"}</div>
                        <div>For: {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName || ""}` : "Not linked to a child"}</div>
                        <div>Description: {selectedTemplate?.description || "No template description available."}</div>
                      </div>
                    </div>
                    {selectedTemplate?.requiresRenewal ? (
                      <div className="rounded-2xl border border-amber-200 bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
                        Renewal every {selectedTemplate.renewalPeriodDays || "?"} days
                      </div>
                    ) : null}
                  </div>

                  {activeRenewalId ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm text-emerald-800">
                      You are updating a previous submission. The last saved answers were loaded as your starting point.
                    </div>
                  ) : null}
                </div>

                {selectedTemplateFields.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          Guided form fields
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          Use the guided view for normal submissions. Switch to raw JSON only when needed.
                        </div>
                      </div>
                      <ParentButton
                        type="button"
                        variant="secondary"
                        onClick={() => handleRawModeChange(!rawMode)}
                      >
                        {rawMode ? "Use guided form" : "Switch to raw JSON"}
                      </ParentButton>
                    </div>

                    {rawMode ? (
                      <RawJsonEditor value={rawDataText} onChange={setRawDataText} />
                    ) : (
                      <GuidedFormFields
                        fields={selectedTemplateFields}
                        values={formValues}
                        onChange={(name, nextValue) =>
                          setFormValues((current) => ({ ...current, [name]: nextValue }))
                        }
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-600">
                      This template does not define guided fields yet. You can still submit it as-is or include structured JSON below if the center asked for extra details.
                    </div>
                    <RawJsonEditor value={rawDataText} onChange={setRawDataText} />
                  </div>
                )}

                {draftState.errors.length ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {draftState.errors[0]}
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-gray-200 bg-white p-4">
                  <div className="text-sm font-extrabold text-gray-900">Data being submitted</div>
                  <div className="mt-3 space-y-3">
                    {draftSummary.length ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {draftSummary.map((item) => (
                          <div
                            key={`draft-${item.label}`}
                            className="rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2"
                          >
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                              {item.label}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-500">
                        No additional structured data will be sent with this submission.
                      </div>
                    )}

                    {draftState.hasAnyData ? (
                      <pre className="max-h-56 overflow-auto rounded-2xl border border-gray-200 bg-gray-950 px-4 py-3 text-xs text-gray-100">
                        {formatJsonText(draftState.data)}
                      </pre>
                    ) : null}
                  </div>
                </div>

                <ParentButton
                  type="submit"
                  disabled={saving || !templateId || draftState.errors.length > 0}
                  className="w-full"
                >
                  {saving ? "Submitting..." : activeRenewalId ? "Submit renewal" : "Submit form"}
                </ParentButton>
              </form>
            </ParentSection>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}

function RawJsonEditor({ value, onChange }) {
  return (
    <ParentField
      label="Additional data"
      hint='Optional. JSON only, for example: {"allergies":"Peanuts","notes":"Updated immunization record attached"}'
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
        placeholder='{"field":"value"}'
      />
    </ParentField>
  );
}

function GuidedFormFields({ fields, values, onChange }) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <GuidedField key={field.name} field={field} value={values[field.name]} onChange={onChange} />
      ))}
    </div>
  );
}

function GuidedField({ field, value, onChange }) {
  const commonClassName =
    "w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === "textarea") {
    return (
      <ParentField label={label} hint={field.helpText}>
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={field.rows || 4}
          className={commonClassName}
          placeholder={field.placeholder || ""}
        />
      </ParentField>
    );
  }

  if (field.type === "select") {
    return (
      <ParentField label={label} hint={field.helpText}>
        <select
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={commonClassName}
        >
          <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
          {field.options.map((option) => (
            <option key={`${field.name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ParentField>
    );
  }

  if (field.type === "radio") {
    return (
      <ParentField label={label} hint={field.helpText}>
        <div className="grid gap-2">
          {field.options.map((option) => (
            <label
              key={`${field.name}-${option.value}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
            >
              <input
                type="radio"
                name={field.name}
                value={option.value}
                checked={String(value || "") === option.value}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </ParentField>
    );
  }

  if (field.type === "checkbox") {
    return (
      <ParentField label={label} hint={field.helpText}>
        <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>{field.placeholder || "Check to confirm"}</span>
        </label>
      </ParentField>
    );
  }

  if (field.type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <ParentField label={label} hint={field.helpText}>
        <div className="grid gap-2">
          {field.options.map((option) => {
            const checked = selectedValues.includes(option.value);
            return (
              <label
                key={`${field.name}-${option.value}`}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const nextValues = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((entry) => entry !== option.value);
                    onChange(field.name, nextValues);
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </ParentField>
    );
  }

  if (field.type === "json") {
    return (
      <ParentField label={label} hint={field.helpText || "JSON object or array"}>
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={field.rows || 5}
          className={`${commonClassName} font-mono`}
          placeholder={field.placeholder || "{}"}
        />
      </ParentField>
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "email"
          ? "email"
          : "text";

  return (
    <ParentField label={label} hint={field.helpText}>
      <input
        type={inputType}
        value={value ?? ""}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={commonClassName}
        placeholder={field.placeholder || ""}
        step={field.type === "number" ? "any" : undefined}
      />
    </ParentField>
  );
}

function normalizeTemplateFields(schema) {
  if (!schema || typeof schema !== "object") return [];

  const sourceFields = Array.isArray(schema)
    ? schema
    : Array.isArray(schema.fields)
      ? schema.fields
      : schema.properties && typeof schema.properties === "object"
        ? Object.entries(schema.properties).map(([name, config]) => ({
            ...(config && typeof config === "object" && !Array.isArray(config) ? config : {}),
            name,
          }))
        : [];

  return sourceFields
    .map((field, index) => normalizeTemplateField(field, index))
    .filter(Boolean);
}

function normalizeTemplateField(field, index) {
  if (!field || typeof field !== "object" || Array.isArray(field)) return null;

  const rawName = field.name || field.key || field.id || `field_${index + 1}`;
  const name = String(rawName || "").trim();
  if (!name) return null;

  const type = normalizeFieldType(field.type || field.input || field.component);

  return {
    name,
    label: String(field.label || field.title || humanizeKey(name)),
    type,
    required: Boolean(field.required),
    placeholder: String(field.placeholder || ""),
    helpText: String(field.helpText || field.description || ""),
    rows: Number(field.rows) > 0 ? Number(field.rows) : undefined,
    options: normalizeFieldOptions(field.options || field.enum || field.choices),
    defaultValue:
      field.defaultValue !== undefined
        ? field.defaultValue
        : field.default !== undefined
          ? field.default
          : defaultValueForFieldType(type),
  };
}

function normalizeFieldType(type) {
  const value = String(type || "text").trim().toLowerCase();
  if (["textarea", "multiline", "longtext"].includes(value)) return "textarea";
  if (["number", "integer", "float", "decimal"].includes(value)) return "number";
  if (["date", "datetime", "datetime-local"].includes(value)) return "date";
  if (value === "email") return "email";
  if (["select", "dropdown"].includes(value)) return "select";
  if (value === "radio") return "radio";
  if (["checkbox", "boolean", "toggle"].includes(value)) return "checkbox";
  if (["multiselect", "array", "checkbox-group"].includes(value)) return "multiselect";
  if (["json", "object"].includes(value)) return "json";
  return "text";
}

function normalizeFieldOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (option && typeof option === "object" && !Array.isArray(option)) {
        const value = String(option.value ?? option.id ?? option.label ?? "").trim();
        if (!value) return null;
        return {
          value,
          label: String(option.label ?? option.name ?? option.value ?? value),
        };
      }
      const value = String(option || "").trim();
      if (!value) return null;
      return { value, label: value };
    })
    .filter(Boolean);
}

function buildInitialFormValues(fields, sourceData = null) {
  const source =
    sourceData && typeof sourceData === "object" && !Array.isArray(sourceData) ? sourceData : {};

  return fields.reduce((acc, field) => {
    const rawValue =
      source[field.name] !== undefined ? source[field.name] : field.defaultValue;
    acc[field.name] = normalizeFieldValue(field, rawValue);
    return acc;
  }, {});
}

function normalizeFieldValue(field, rawValue) {
  if (field.type === "checkbox") return Boolean(rawValue);
  if (field.type === "multiselect") return Array.isArray(rawValue) ? rawValue.map(String) : [];
  if (field.type === "json") {
    if (rawValue === undefined || rawValue === null || rawValue === "") return "";
    return formatJsonText(rawValue);
  }
  if (field.type === "number") return rawValue ?? "";
  return rawValue == null ? "" : String(rawValue);
}

function defaultValueForFieldType(type) {
  if (type === "checkbox") return false;
  if (type === "multiselect") return [];
  return "";
}

function buildDraftState({ fields, values, rawMode, rawText }) {
  if (rawMode || fields.length === 0) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return { data: null, errors: [], hasAnyData: false };
    try {
      const data = JSON.parse(trimmed);
      return { data, errors: [], hasAnyData: hasAnyData(data) };
    } catch {
      return {
        data: null,
        errors: ["Additional data must be valid JSON before you can submit."],
        hasAnyData: false,
      };
    }
  }

  const data = {};
  const errors = [];

  for (const field of fields) {
    const rawValue = values[field.name];

    if (field.type === "checkbox") {
      if (field.required && !rawValue) {
        errors.push(`${field.label} must be checked before you can submit.`);
        continue;
      }
      data[field.name] = Boolean(rawValue);
      continue;
    }

    if (field.type === "multiselect") {
      const normalized = Array.isArray(rawValue)
        ? rawValue.map((entry) => String(entry).trim()).filter(Boolean)
        : [];
      if (field.required && normalized.length === 0) {
        errors.push(`${field.label} is required.`);
        continue;
      }
      if (normalized.length > 0) data[field.name] = normalized;
      continue;
    }

    if (field.type === "number") {
      const textValue = String(rawValue ?? "").trim();
      if (!textValue) {
        if (field.required) errors.push(`${field.label} is required.`);
        continue;
      }
      const numeric = Number(textValue);
      if (!Number.isFinite(numeric)) {
        errors.push(`${field.label} must be a valid number.`);
        continue;
      }
      data[field.name] = numeric;
      continue;
    }

    if (field.type === "json") {
      const textValue = String(rawValue ?? "").trim();
      if (!textValue) {
        if (field.required) errors.push(`${field.label} is required.`);
        continue;
      }
      try {
        data[field.name] = JSON.parse(textValue);
      } catch {
        errors.push(`${field.label} must contain valid JSON.`);
      }
      continue;
    }

    const textValue = String(rawValue ?? "").trim();
    if (!textValue) {
      if (field.required) errors.push(`${field.label} is required.`);
      continue;
    }
    data[field.name] = textValue;
  }

  return { data, errors, hasAnyData: hasAnyData(data) };
}

function summarizeSubmissionData(data, limit = 4) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return [{ label: "Entries", value: `${data.length} item${data.length === 1 ? "" : "s"}` }];
  }
  if (typeof data !== "object") {
    return [{ label: "Value", value: formatPreviewValue(data) }];
  }
  return Object.entries(data)
    .slice(0, limit)
    .map(([key, value]) => ({
      label: humanizeKey(key),
      value: formatPreviewValue(value),
    }));
}

function formatPreviewValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map((entry) => formatPreviewValue(entry)).join(", ") : "None";
  }
  if (value && typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 117)}...` : json;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasAnyData(data) {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  if (typeof data === "boolean") return true;
  return String(data).trim().length > 0;
}

function formatJsonText(data) {
  if (data == null || data === "") return "";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "";
  }
}
