import AdminLayout from "@/components/admin/AdminLayout";
import AdminReportsWorkspace, {
  findAdminReport,
} from "@/components/admin/AdminReportsWorkspace";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";
import { useRouter } from "next/router";

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
      ) : (
        <AdminReportsWorkspace reportKey={reportKey} />
      )}
    </AdminLayout>
  );
}
