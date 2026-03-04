import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

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
      setTemplates(tArr);
      if (!templateId) setTemplateId(tArr[0]?.id || "");
      setSubmissions(Array.isArray(s) ? s : []);
      const kidsArr = Array.isArray(kids) ? kids : [];
      setChildren(kidsArr);
      if (!childId) setChildId(kidsArr[0]?.id || "");
    } catch (e) {
      setError(e.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [templates]);

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
          throw new Error("Form data must be valid JSON (or empty).");
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
      setSuccess("Form submitted.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to submit form");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ParentLayout title="Forms">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Online Forms</h2>
        <p className="mt-1 text-sm text-gray-600">
          Submit enrollment/health/emergency forms online (basic templates + submissions).
        </p>

        {error ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>{error}</span>
            <button type="button" onClick={() => { setError(""); refresh(); }} className="ml-3 text-xs font-semibold text-red-600 underline hover:text-red-800">Retry</button>
          </div>
        ) : null}
        {success ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              My Submissions
            </div>
            {loading ? (
              <div className="mt-3 text-sm text-gray-600">Loading…</div>
            ) : submissions.length === 0 ? (
              <div className="mt-3 text-sm text-gray-600">No submissions yet.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {submissions.slice(0, 20).map((s) => {
                  const isExpired = s.expiresAt && new Date(s.expiresAt) < new Date();
                  const isExpiringSoon = s.expiresAt && !isExpired && new Date(s.expiresAt) <= new Date(Date.now() + 30 * 86400000);
                  return (
                    <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-sm font-extrabold text-gray-900">
                        {s.template?.title || "Form"}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(s.createdAt).toLocaleString()} · {s.status}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Child: {s.child ? `${s.child.firstName} ${s.child.lastName || ""}` : "—"}
                      </div>
                      {s.expiresAt && (
                        <div className={`mt-1 text-xs font-bold ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-gray-500"}`}>
                          {isExpired ? "EXPIRED" : `Expires: ${new Date(s.expiresAt).toLocaleDateString()}`}
                          {(isExpired || isExpiringSoon) && (
                            <button
                              type="button"
                              onClick={() => { setTemplateId(s.templateId); setChildId(s.childId || ""); }}
                              className="ml-2 text-blue-600 underline font-bold"
                            >
                              Renew
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Submit a Form
            </div>
            <form onSubmit={submit} className="mt-3 space-y-3">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Template
                </div>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a template…</option>
                  {sortedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Child (optional)
                </div>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">(none)</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName || ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Data (JSON)
                </div>
                <textarea
                  value={dataText}
                  onChange={(e) => setDataText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                  rows={7}
                  placeholder='{"field":"value"}'
                />
              </label>

              <button
                type="submit"
                disabled={saving || !templateId}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Submitting…" : "Submit"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
