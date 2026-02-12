import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function toDateInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TeacherTimeOff() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [requestType, setRequestType] = useState("PTO");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
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

  async function refreshTemplatesAndSubmissions(id = centerId) {
    setLoadingTemplates(true);
    setError("");
    try {
      const [t, s] = await Promise.all([
        apiJson(
          `/api/v1/forms/templates${id ? `?centerId=${encodeURIComponent(id)}` : ""}`,
        ),
        apiJson("/api/v1/forms/submissions"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setSubmissions(Array.isArray(s) ? s : []);
    } catch (e) {
      setError(e.message || "Failed to load time off data");
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    refreshTemplatesAndSubmissions(centerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  const ptoTemplate = useMemo(() => {
    const list = templates || [];
    const match = list.find((t) => {
      const title = String(t?.title || "").toLowerCase();
      return title.includes("pto") || title.includes("time off") || title.includes("time-off");
    });
    return match || null;
  }, [templates]);

  const myPtoSubmissions = useMemo(() => {
    if (!ptoTemplate) return [];
    return (submissions || [])
      .filter((s) => s?.templateId === ptoTemplate.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [submissions, ptoTemplate]);

  const calendarRows = useMemo(() => {
    return myPtoSubmissions
      .map((s) => {
        const data = s?.data && typeof s.data === "object" ? s.data : {};
        return {
          id: s.id,
          status: s.status || "SUBMITTED",
          createdAt: s.createdAt,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          requestType: data.requestType || null,
          reason: data.reason || null,
        };
      })
      .sort((a, b) => byString(a.startDate, b.startDate));
  }, [myPtoSubmissions]);

  async function submit(e) {
    e.preventDefault();
    if (!ptoTemplate) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!startDate || !endDate) throw new Error("Start and end date are required.");
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Invalid date.");
      }
      if (end < start) throw new Error("End date cannot be before start date.");

      await apiJson("/api/v1/forms/submissions", {
        method: "POST",
        body: JSON.stringify({
          templateId: ptoTemplate.id,
          data: {
            startDate,
            endDate,
            requestType,
            reason: reason || null,
          },
        }),
      });
      setReason("");
      setSuccess("Time off request submitted.");
      await refreshTemplatesAndSubmissions();
    } catch (e2) {
      setError(e2.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  }

  const suggestedTemplateJson = useMemo(() => {
    return JSON.stringify(
      {
        fields: [
          { name: "startDate", type: "date", label: "Start Date" },
          { name: "endDate", type: "date", label: "End Date" },
          { name: "requestType", type: "select", label: "Type", options: ["PTO", "Sick", "Unpaid", "Other"] },
          { name: "reason", type: "text", label: "Reason" },
        ],
      },
      null,
      2,
    );
  }, []);

  return (
    <TeacherLayout title="Time Off Request">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Time Off Request</h2>
              <p className="mt-1 text-sm text-gray-600">
                Submit PTO requests and view your time off calendar.
              </p>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">(all accessible centers)</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          ) : null}

          {loadingTemplates ? (
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : !ptoTemplate ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-extrabold text-amber-900">
                PTO form template not found
              </div>
              <div className="mt-1 text-sm text-amber-900/90">
                An admin must create a form template targeted to the <span className="font-semibold">TEACHER</span>{" "}
                role with a title containing “PTO” or “Time Off”.
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-900/70">
                Suggested schema (paste into Admin → Forms)
              </div>
              <pre className="mt-2 overflow-auto rounded-xl border border-amber-200 bg-white p-3 text-xs text-gray-800">
                {suggestedTemplateJson}
              </pre>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Submit request
                </div>
                <form onSubmit={submit} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Start date
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        End date
                      </div>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Type
                    </div>
                    <select
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      {["PTO", "Sick", "Unpaid", "Other"].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Reason (optional)
                    </div>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Short note"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Submitting…" : "Submit request"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  My time off calendar
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Your submitted requests (admin can view all submissions).
                </p>

                {calendarRows.length ? (
                  <div className="mt-3 space-y-2">
                    {calendarRows.map((r) => (
                      <div key={r.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {r.requestType || "Time off"}
                          </div>
                          <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-extrabold text-gray-700">
                            {r.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          {r.startDate || "—"} → {r.endDate || "—"}
                        </div>
                        {r.reason ? (
                          <div className="mt-1 text-xs text-gray-600">{r.reason}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No time off requests submitted yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

