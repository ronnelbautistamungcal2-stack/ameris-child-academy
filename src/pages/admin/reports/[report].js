import AdminLayout from "@/components/admin/AdminLayout";
import AdminReportsWorkspace, {
  findAdminReport,
} from "@/components/admin/AdminReportsWorkspace";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";
import { InfantFeedingReport, MealClaimReport, MealProductionReport } from "@/components/reports/MealReports";
import { ChildStepsReport, MilestoneProgressReport } from "@/components/reports/MilestoneReports";
import { useRouter } from "next/router";

// Reports that bring their own filters and printable sheet.
const STANDALONE = {
  "milestone-progress": <MilestoneProgressReport />,
  "child-steps": <ChildStepsReport />,
  "infant-feeding": <InfantFeedingReport />,
  "meal-production": <MealProductionReport />,
  "meal-claim": <MealClaimReport />,
};

export default function AdminReportPage() {
  const router = useRouter();
  const reportKey =
    typeof router.query.report === "string" ? router.query.report : "";
  const report = findAdminReport(reportKey);

  return (
    <AdminLayout title={report ? report.label : "Reports"}>
      {!router.isReady ? (
        <div className="p-6 text-sm text-gray-600">Loading…</div>
      ) : reportKey === "infant-feeding-plan" ? (
        <InfantFeedingPlanReport />
      ) : STANDALONE[reportKey] ? (
        STANDALONE[reportKey]
      ) : (
        <AdminReportsWorkspace reportKey={reportKey} />
      )}
    </AdminLayout>
  );
}
