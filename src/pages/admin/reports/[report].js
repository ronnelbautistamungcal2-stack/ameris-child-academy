import AdminReportsPage from "@/components/admin/AdminReportsPage";
import { useRouter } from "next/router";

export default function AdminReportPage() {
  const router = useRouter();
  return <AdminReportsPage reportKey={typeof router.query.report === "string" ? router.query.report : ""} />;
}
