import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

// My Performance › Evaluations (client mockup 27-Evaluations): the
// evaluations sent to the signed-in staff member (drafts stay hidden) with
// category scores out of 5, strengths, areas for improvement and goals, and an
// Acknowledge button.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const fmt = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function periodLabel(ev) {
  const day = (v) => new Date(v).toISOString().slice(0, 10);
  if (ev.periodStart && ev.periodEnd) return `${day(ev.periodStart)} to ${day(ev.periodEnd)}`;
  return ev.period || "Evaluation";
}

function StatCard({ label, value, tone, icon }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40",
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${tones[tone]}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl dark:bg-gray-900" aria-hidden>{icon}</span>
      <div>
        <div className={`text-sm font-semibold ${NAVY}`}>{label}</div>
        <div className={`text-2xl font-black ${NAVY}`}>{value}</div>
      </div>
    </div>
  );
}

export default function MyEvaluations({ centerId }) {
  const [evaluations, setEvaluations] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await apiJson(`/api/v1/evaluations?${new URLSearchParams({ mine: "1", ...(centerId ? { centerId } : {}) })}`);
      setEvaluations((Array.isArray(rows) ? rows : []).filter((e) => e.status !== "DRAFT"));
    } catch (e) {
      setError(e.message || "Failed to load evaluations");
      setEvaluations([]);
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(id) {
    setBusy(id);
    try {
      await apiJson(`/api/v1/evaluations/${id}/acknowledge`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to acknowledge");
    } finally {
      setBusy("");
    }
  }

  if (!evaluations) return <Skeleton count={4} />;
  const awaiting = evaluations.filter((e) => e.status === "SUBMITTED").length;
  const acknowledged = evaluations.filter((e) => e.status === "ACKNOWLEDGED").length;
  const scored = evaluations.filter((e) => Number.isFinite(e.overallScore));
  const average = scored.length ? `${Math.round(scored.reduce((s, e) => s + e.overallScore, 0) / scored.length)}%` : "-";

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visible Evaluations" value={evaluations.length} tone="blue" icon="📋" />
        <StatCard label="Awaiting Acknowledgement" value={awaiting} tone="amber" icon="⏳" />
        <StatCard label="Acknowledged" value={acknowledged} tone="green" icon="✅" />
        <StatCard label="Average Score" value={average} tone="indigo" icon="📊" />
      </div>
      {!evaluations.length ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800">No evaluations have been sent to you yet.</p>
      ) : null}
      {evaluations.map((ev) => (
        <article key={ev.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-lg font-black ${NAVY}`}>{periodLabel(ev)}</h3>
                {ev.evaluationType ? <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">{ev.evaluationType}</span> : null}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ev.status === "ACKNOWLEDGED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {ev.status === "ACKNOWLEDGED" ? "Acknowledged" : "Awaiting acknowledgement"}
                </span>
              </div>
              <p className="text-sm text-gray-500">By {ev.evaluator?.name || "Administrator"} • Created {fmt(ev.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-lg px-3 py-1.5 text-sm font-black ${!Number.isFinite(ev.overallScore) ? "bg-red-50 text-red-700" : ev.overallScore >= 80 ? "bg-emerald-50 text-emerald-700" : ev.overallScore >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                {Number.isFinite(ev.overallScore) ? `${ev.overallScore}%` : "No score"}
              </span>
              {ev.status === "SUBMITTED" ? (
                <button type="button" onClick={() => acknowledge(ev.id)} disabled={busy === ev.id} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy === ev.id ? "Acknowledging..." : "Acknowledge"}
                </button>
              ) : null}
            </div>
          </div>
          {ev.categories && Object.keys(ev.categories).length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
              {Object.entries(ev.categories).map(([category, score]) => (
                <div key={category} className="rounded-xl border border-gray-100 bg-blue-50/50 p-3 text-center dark:border-gray-800 dark:bg-gray-800">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">{category}</div>
                  <div className={`mt-1 text-xl font-black ${NAVY}`}>
                    {score == null ? <span className="text-sm text-gray-400">Not evaluated</span> : <>{score}<span className="text-sm text-gray-400">/5</span></>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ["Strengths", ev.strengths],
              ["Areas for Improvement", ev.areasForImprovement],
              ["Goals", ev.goals],
              ["Notes", ev.notes],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className={`text-sm font-bold ${NAVY}`}>{label}</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{value}</p>
                </div>
              ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Score: {Number.isFinite(ev.overallScore) ? `${ev.overallScore}%` : "Not scored"} | Status: {ev.status === "ACKNOWLEDGED" ? "Acknowledged" : "Submitted"}
            {ev.teacherAcknowledgedAt ? ` | Acknowledged: ${fmt(ev.teacherAcknowledgedAt)}` : ""}
          </p>
        </article>
      ))}
    </div>
  );
}
