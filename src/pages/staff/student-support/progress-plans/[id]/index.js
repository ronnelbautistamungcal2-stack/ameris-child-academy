import StaffLayout from "@/components/staff/StaffLayout";
import IppPlanView from "@/components/ipp/IppPlanView";
import { NAVY } from "@/components/ipp/ippUi";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

const ROLES = ["STUDENT_SUPPORT"];

export default function ProgressPlanPage() {
  const router = useRouter();
  const { id } = router.query;
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setPlan(await apiJson(`/api/v1/ipp/${id}`));
    } catch (e) {
      setError(e.message || "Could not load the plan");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <StaffLayout title="Individual Progress Plan" roles={ROLES}>
      <div className="space-y-4">
        <nav className="text-sm text-blue-700 print:hidden dark:text-blue-300">
          <Link href="/staff/student-support/progress-plans" className="hover:underline">Individual Progress Plans</Link>
          {plan ? <> {"›"} {plan.child.name}</> : null}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={`text-3xl font-black ${NAVY}`}>Individual Progress Plan</h1>
          {plan && (
            <div className="flex gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                {"\u{1F5A8}"} Print
              </button>
              {plan.canManage && (
                <Link href={`/staff/student-support/progress-plans/${plan.id}/edit`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  {"✎"} Edit Plan
                </Link>
              )}
            </div>
          )}
        </div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {plan ? <IppPlanView plan={plan} onChanged={load} /> : !error && <p className="text-sm text-gray-500">Loading...</p>}
      </div>
    </StaffLayout>
  );
}
