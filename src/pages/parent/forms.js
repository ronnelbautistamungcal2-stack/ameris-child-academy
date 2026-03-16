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
import { useEffect, useMemo, useState } from "react";

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
  const [dataText, setDataText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [t, s, kids] = await Promise.all([
        apiJson("/api/v1/forms/templates"),
        apiJson("/api/v1/forms/submissions"),
        apiJson("/api/v1/children"),
      ]);
      const tArr = Array.isArray(t) ? t : [];
      const kidsArr = Array.isArray(kids) ? kids : [];
      setTemplates(tArr);
      setSubmissions(Array.isArray(s) ? s : []);
      setChildren(kidsArr);
      setTemplateId((current) => current || tArr[0]?.id || "");
      setChildId((current) => current || kidsArr[0]?.id || "");
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

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let data = null;
      const trimmed = dataText.trim();
      if (trimmed) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          throw new Error("Form data must be valid JSON or left blank.");
        }
      }

      await apiJson("/api/v1/forms/submissions", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          childId: childId || null,
          data,
        }),
      });
      setDataText("");
      setSuccess("Form submitted successfully.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to submit form");
    } finally {
      setSaving(false);
    }
  }

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
            description="See what has already been filed and jump back into items that are expiring soon."
            className="bg-gradient-to-br from-white via-emerald-50/40 to-white"
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

                        {(isExpired || isExpiringSoon) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ParentButton
                              variant="soft"
                              onClick={() => {
                                setTemplateId(submission.templateId);
                                setChildId(submission.childId || "");
                              }}
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

          <ParentSection
            title="Submit a new form"
            description="Pick the form, choose the child it belongs to, and send structured notes if the template requires extra details."
            className="relative overflow-hidden bg-gradient-to-br from-white via-white to-cyan-50/40"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/20" />
            <form onSubmit={submit} className="space-y-4">
              <ParentField label="Template">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
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
                <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  Submission preview
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div>Form: {selectedTemplate?.title || "Choose a template"}</div>
                  <div>For: {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName || ""}` : "Not linked to a child"}</div>
                  <div>Description: {selectedTemplate?.description || "No template description available."}</div>
                </div>
              </div>

              <ParentField
                label="Additional data"
                hint='Optional. JSON only, for example: {"allergies":"Peanuts","notes":"Updated immunization record attached"}'
              >
                <textarea
                  value={dataText}
                  onChange={(e) => setDataText(e.target.value)}
                  rows={8}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
                  placeholder='{"field":"value"}'
                />
              </ParentField>

              <ParentButton type="submit" disabled={saving || !templateId} className="w-full">
                {saving ? "Submitting..." : "Submit form"}
              </ParentButton>
            </form>
          </ParentSection>
        </div>
      </div>
    </ParentLayout>
  );
}
