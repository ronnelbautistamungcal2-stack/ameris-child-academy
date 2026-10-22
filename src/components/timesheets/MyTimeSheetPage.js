import { NAVY } from "@/components/reports/reportUi";
import TimeSheetReportBody, { localDay, longDate } from "@/components/timesheets/TimeSheetReportBody";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatDayKey } from "@/lib/checklistTime";
import { rangeContaining, stepRange } from "@/lib/payPeriods";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

// My Time Sheet (client request 2026-10-02): an employee reviews their
// Employee Time Sheet Report for a pay period, e-signs it and submits it.

const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

export default function MyTimeSheetPage({ Layout }) {
  const { data: session } = useSession();
  const userId = session?.user?.id || "";
  const [range, setRange] = useState(() => rangeContaining("PAY_PERIOD"));
  const [data, setData] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [certify, setCertify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setError("");
    setData(null);
    try {
      const [sheet, signed] = await Promise.all([
        apiJson(`/api/v1/time-sheets/staff/${userId}?${new URLSearchParams(range)}`),
        apiJson(`/api/v1/time-sheets/signatures?userId=${userId}`),
      ]);
      setData(sheet);
      setSignatures(Array.isArray(signed) ? signed : []);
    } catch (e) {
      setError(e.message || "Failed to load your time sheet");
    }
  }, [userId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const signature = signatures.find((s) => s.from === range.from && s.to === range.to) || null;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiJson("/api/v1/time-sheets/signatures", {
        method: "POST",
        body: JSON.stringify({ ...range, signatureName: name, certify }),
      });
      setNotice("Your signed time sheet was submitted.");
      setName("");
      setCertify(false);
      await load();
    } catch (e) {
      setError(e.message || "Failed to submit your time sheet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="My Time Sheet">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={`text-3xl font-black ${NAVY}`}>My Time Sheet</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Review your hours for the pay period, then e-sign and submit.</p>
          </div>
          <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
            <button type="button" onClick={() => setRange(stepRange("PAY_PERIOD", range, -1))} className="px-3 py-2 text-blue-700" aria-label="Previous pay period">‹</button>
            <span className={`min-w-[200px] text-center text-sm font-bold ${NAVY}`}>
              {formatDayKey(range.from, { month: "short", day: "numeric", year: "numeric" })} - {formatDayKey(range.to, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button type="button" onClick={() => setRange(stepRange("PAY_PERIOD", range, 1))} className="px-3 py-2 text-blue-700" aria-label="Next pay period">›</button>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

        <div className="rounded-xl border border-gray-200 bg-[#ffffff] p-6 text-black shadow-sm">
          {!data ? (
            <Skeleton count={8} />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-gray-300 pb-3">
                <div>
                  <h2 className="font-serif text-2xl font-bold">Employee Time Sheet Report</h2>
                  <div className="text-sm">{longDate(localDay(range.from))} – {longDate(localDay(range.to))}</div>
                </div>
                <div className="text-sm"><strong>Employee Name:</strong> {data.subject?.name}</div>
              </div>
              <TimeSheetReportBody kind="staff" rows={data.rows} from={range.from} to={range.to} signature={signature} />
            </>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {signature ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-emerald-800 dark:text-emerald-300">
                ✓ Signed by <strong>{signature.signatureName}</strong> on {new Date(signature.signedAt).toLocaleString()} ({signature.totalHours.toFixed(2)} hours).
              </div>
              <a
                href={`/time-sheets/report?${new URLSearchParams({ kind: "staff", id: userId, ...range })}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
              >
                Print signed time sheet
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h2 className={`text-lg font-black ${NAVY}`}>E-sign and Submit</h2>
              <label className="block max-w-md text-sm font-semibold">
                Type your full name to sign
                <input value={name} onChange={(e) => setName(e.target.value)} className={`${control} mt-1 w-full font-serif text-lg italic`} placeholder={session?.user?.name || "Full name"} aria-label="Signature" />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>I confirm the hours on this time sheet are accurate.</span>
              </label>
              <button type="submit" disabled={saving || !name.trim() || !certify || !data} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Submitting..." : "Sign and Submit"}
              </button>
            </form>
          )}
        </div>

        {signatures.length ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className={`mb-2 text-lg font-black ${NAVY}`}>Submitted Time Sheets</h2>
            <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
              {signatures.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <button type="button" onClick={() => setRange({ from: s.from, to: s.to })} className="font-semibold text-blue-700 hover:underline">
                    {formatDayKey(s.from, { month: "short", day: "numeric", year: "numeric" })} – {formatDayKey(s.to, { month: "short", day: "numeric", year: "numeric" })}
                  </button>
                  <span className="text-gray-600 dark:text-gray-400">
                    {s.totalHours.toFixed(2)} hours · signed {new Date(s.signedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
