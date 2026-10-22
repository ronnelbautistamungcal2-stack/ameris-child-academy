import StaffLayout from "@/components/staff/StaffLayout";
import IppForm from "@/components/ipp/IppForm";
import { NAVY } from "@/components/ipp/ippUi";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const ROLES = ["STUDENT_SUPPORT"];

export default function EditProgressPlanPage() {
  const router = useRouter();
  const { id } = router.query;
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiJson(`/api/v1/ipp/${id}`)
      .then(setPlan)
      .catch((e) => setError(e.message || "Could not load the plan"));
  }, [id]);

  return (
    <StaffLayout title="Edit Progress Plan" roles={ROLES}>
      <div className="space-y-4">
        <nav className="text-sm text-blue-700 dark:text-blue-300">
          <Link href="/staff/student-support/progress-plans" className="hover:underline">Individual Progress Plans</Link>
          {plan ? <> {"›"} <Link href={`/staff/student-support/progress-plans/${plan.id}`} className="hover:underline">{plan.child.name}</Link> {"›"} Edit</> : null}
        </nav>
        <h1 className={`text-3xl font-black ${NAVY}`}>Edit Progress Plan</h1>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {plan ? <IppForm plan={plan} /> : !error && <p className="text-sm text-gray-500">Loading...</p>}
      </div>
    </StaffLayout>
  );
}
