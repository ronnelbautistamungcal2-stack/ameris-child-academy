import AdminLayout from "@/components/admin/AdminLayout";
import AdminReportsWorkspace, {
  findAdminReport,
} from "@/components/admin/AdminReportsWorkspace";
import { useRouter } from "next/router";

export default function AdminReportPage() {
  const router = useRouter();
  const reportKey =
    typeof router.query.report === "string" ? router.query.report : "";
  const report = findAdminReport(reportKey);

  return (
    <AdminLayout title={report ? report.label : "Reports"}>
      {router.isReady ? (
        <AdminReportsWorkspace reportKey={reportKey} />
      ) : (
        <div className="p-6 text-sm text-gray-600">Loading…</div>
      )}
    </AdminLayout>
  );
}
