import StaffLayout from "@/components/staff/StaffLayout";
import IppForm from "@/components/ipp/IppForm";
import { NAVY } from "@/components/ipp/ippUi";
import Link from "next/link";

const ROLES = ["STUDENT_SUPPORT"];

export default function NewProgressPlanPage() {
  return (
    <StaffLayout title="New Progress Plan" roles={ROLES}>
      <div className="space-y-4">
        <nav className="text-sm text-blue-700 dark:text-blue-300">
          <Link href="/staff/student-support/progress-plans" className="hover:underline">Individual Progress Plans</Link> {"›"} New Progress Plan
        </nav>
        <h1 className={`text-3xl font-black ${NAVY}`}>New Progress Plan</h1>
        <IppForm />
      </div>
    </StaffLayout>
  );
}
