import AdminLayout from "@/components/admin/AdminLayout";
import AdminReportsWorkspace from "@/components/admin/AdminReportsWorkspace";
import StaffPerformanceOverview from "@/components/performance/StaffPerformanceOverview";
import CarpoolReport from "@/components/reports/CarpoolReport";
import CenterPerformance from "@/components/reports/CenterPerformance";
import ClassReportWorkspace from "@/components/reports/ClassReportWorkspace";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";
import { InfantFeedingReport, MealClaimReport, MealProductionReport } from "@/components/reports/MealReports";
import MilestoneChangeLog from "@/components/reports/MilestoneChangeLog";
import { ChildStepsReport, MilestoneProgressReport } from "@/components/reports/MilestoneReports";
import ReportsHub from "@/components/reports/ReportsHub";
import StaffPerformanceReport from "@/components/reports/StaffPerformanceReport";
import StaffTrainingReport from "@/components/reports/StaffTrainingReport";
import StudentReportWorkspace from "@/components/reports/StudentReportWorkspace";
import TimeSheetReports from "@/components/reports/TimeSheetReports";
import { useRouter } from "next/router";
import { useEffect } from "react";

// Admin Reports (client mockup 15-01; reworked 2026-10-29): the Student,
// Class and Staff reports are the same ones coaches use, the Overview is the
// Center Performance Overview, the Teacher / Coach / Other Staff reports are
// one Staff Performance Report, and the time sheet, training and milestone
// change reports are new.

const Plain = ({ children }) => children;

const REPORTS = {
  overview: { label: "Center Performance Overview", render: () => <CenterPerformance showCounts /> },
  students: { label: "Student Performance", render: () => <StudentReportWorkspace /> },
  "class-performance": { label: "Class Performance", render: () => <ClassReportWorkspace /> },
  "milestone-progress": { label: "Milestone Progress Report", addOn: "STEPS_OF_PROGRESSION", render: () => <MilestoneProgressReport /> },
  "child-steps": { label: "Child Steps of Progression", addOn: "STEPS_OF_PROGRESSION", render: () => <ChildStepsReport /> },
  "milestone-changes": { label: "Milestone Change Log", addOn: "STEPS_OF_PROGRESSION", render: () => <MilestoneChangeLog /> },
  carpool: { label: "Carpool Report", render: () => <CarpoolReport /> },
  "infant-feeding-plan": { label: "Infant Feeding Plan", render: () => <InfantFeedingPlanReport /> },
  "infant-feeding": { label: "Infant Feeding Report", render: () => <InfantFeedingReport /> },
  "meal-production": { label: "Meal Production Record", render: () => <MealProductionReport /> },
  "meal-claim": { label: "Meal Claim", ownExport: true, render: () => <MealClaimReport /> },
  "staff-overview": { label: "Staff Performance Overview", addOn: "STAFF_MANAGEMENT", render: () => <StaffPerformanceOverview Layout={Plain} viewHref={(row) => `/admin/reports/staff-performance?staffId=${row.id}`} /> },
  "staff-performance": { label: "Staff Performance Report", addOn: "STAFF_MANAGEMENT", render: () => <StaffPerformanceReport /> },
  "staff-training": { label: "Staff Training Report", addOn: "TEACHER_TRAINING", render: () => <StaffTrainingReport /> },
  "student-time-sheets": { label: "Student Time Sheets", addOn: "STAFF_MANAGEMENT", render: () => <TimeSheetReports kind="child" mode="sheets" /> },
  "student-time-overview": { label: "Student Time Overview", addOn: "STAFF_MANAGEMENT", render: () => <TimeSheetReports kind="child" mode="overview" /> },
  "staff-time-sheets": { label: "Staff Time Sheets", addOn: "STAFF_MANAGEMENT", render: () => <TimeSheetReports kind="staff" mode="sheets" /> },
  "staff-time-overview": { label: "Staff Time Overview", addOn: "STAFF_MANAGEMENT", render: () => <TimeSheetReports kind="staff" mode="overview" /> },
  query: { label: "Custom Query", render: () => <AdminReportsWorkspace reportKey="query" /> },
};

// Links to the reports this page replaced keep working.
const RENAMED = { teachers: "staff-performance", "coach-performance": "staff-performance", "other-staff": "staff-performance" };

const CATEGORIES = [
  { label: "Children & Development", icon: "🧒", keys: ["overview", "students", "class-performance", "milestone-progress", "child-steps", "milestone-changes", "carpool"] },
  { label: "Meals", icon: "🍽️", keys: ["infant-feeding-plan", "infant-feeding", "meal-production", "meal-claim"] },
  { label: "Staff", icon: "👥", keys: ["staff-overview", "staff-performance", "staff-training"] },
  { label: "Time Sheets", icon: "🕒", keys: ["student-time-sheets", "student-time-overview", "staff-time-sheets", "staff-time-overview"] },
  { label: "Custom", icon: "🔎", keys: ["query"] },
].map((cat) => ({ ...cat, reports: cat.keys.map((key) => ({ key, label: REPORTS[key].label, addOn: REPORTS[key].addOn, ownExport: REPORTS[key].ownExport })) }));

export default function AdminReportsPage({ reportKey }) {
  const router = useRouter();
  const renamed = RENAMED[reportKey];
  useEffect(() => {
    if (renamed) router.replace({ pathname: `/admin/reports/${renamed}`, query: router.query.teacherId ? { staffId: router.query.teacherId } : {} });
  }, [renamed, router]);
  const key = REPORTS[reportKey] ? reportKey : renamed || "overview";
  return (
    <AdminLayout title={REPORTS[key].label} contentMaxWidthClassName="max-w-[1600px]">
      <ReportsHub categories={CATEGORIES} selectedKey={key} hrefFor={(k) => `/admin/reports/${k}`}>
        <div key={key}>{REPORTS[key].render()}</div>
      </ReportsHub>
    </AdminLayout>
  );
}
