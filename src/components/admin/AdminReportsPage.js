import AdminLayout from "@/components/admin/AdminLayout";
import AdminReportsWorkspace, { findAdminReport } from "@/components/admin/AdminReportsWorkspace";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";
import { InfantFeedingReport, MealClaimReport, MealProductionReport } from "@/components/reports/MealReports";
import { ChildStepsReport, MilestoneProgressReport } from "@/components/reports/MilestoneReports";
import ReportsHub from "@/components/reports/ReportsHub";

// Admin Reports (client mockup 15-01): every admin report, by category.

const CATEGORIES = [
  { label: "Children & Development", icon: "🧒", keys: ["overview", "students", "class-performance", "milestone-progress", "child-steps"] },
  { label: "Meals", icon: "🍽️", keys: ["infant-feeding-plan", "infant-feeding", "meal-production", "meal-claim"] },
  { label: "Staff", icon: "👥", keys: ["teachers", "coach-performance", "other-staff"] },
  { label: "Custom", icon: "🔎", keys: ["query"] },
].map((cat) => ({ ...cat, reports: cat.keys.map((key) => ({ key, label: findAdminReport(key)?.label || key })) }));

// Reports that bring their own filters and printable sheet.
const STANDALONE = {
  "infant-feeding-plan": InfantFeedingPlanReport,
  "milestone-progress": MilestoneProgressReport,
  "child-steps": ChildStepsReport,
  "infant-feeding": InfantFeedingReport,
  "meal-production": MealProductionReport,
  "meal-claim": MealClaimReport,
};

export default function AdminReportsPage({ reportKey }) {
  const key = reportKey && findAdminReport(reportKey) ? reportKey : "overview";
  const Standalone = STANDALONE[key];
  return (
    <AdminLayout title={findAdminReport(key)?.label || "Reports"} contentMaxWidthClassName="max-w-[1600px]">
      <ReportsHub categories={CATEGORIES} selectedKey={key} hrefFor={(k) => `/admin/reports/${k}`}>
        {Standalone ? <Standalone key={key} /> : <AdminReportsWorkspace key={key} reportKey={key} />}
      </ReportsHub>
    </AdminLayout>
  );
}
