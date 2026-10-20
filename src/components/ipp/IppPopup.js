import { PlanHeader, PlanOverview } from "@/components/ipp/IppPlanView";
import { NAVY } from "@/components/ipp/ippUi";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Parent / Teacher - Child Individual Progress Plan (client mockup 2026-10-02):
// the plan's header and overview, read-only, in a pop-up opened from the
// Student Performance Report.
export default function IppPopup({ planId, onClose }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson(`/api/v1/ipp/${planId}`)
      .then(setPlan)
      .catch((e) => setError(e.message || "Could not load the plan"));
  }, [planId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ipp-popup-title">
      <div className="my-6 w-full max-w-5xl space-y-4 rounded-2xl bg-[#eef4fb] p-5 shadow-xl dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <h2 id="ipp-popup-title" className={`text-2xl font-black ${NAVY}`}>Individual Progress Plan</h2>
          <div className="flex gap-2">
            {plan && (
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-semibold text-blue-700 print:hidden dark:text-blue-300">
                {"\u{1F5A8}"} Print
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-2xl text-[#0b2a5b] print:hidden dark:text-blue-100">&times;</button>
          </div>
        </div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {!plan && !error && <p className="text-sm text-gray-500">Loading...</p>}
        {plan && (
          <>
            <PlanHeader plan={plan} />
            <PlanOverview plan={plan} />
          </>
        )}
      </div>
    </div>
  );
}
