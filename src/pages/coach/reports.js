import CoachActivityReport from "@/components/coach/CoachActivityReport";
import CoachLayout from "@/components/coach/CoachLayout";
import StaffPerformanceOverview from "@/components/performance/StaffPerformanceOverview";
import ClassReportWorkspace from "@/components/reports/ClassReportWorkspace";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";
import { InfantFeedingReport, MealClaimReport, MealProductionReport } from "@/components/reports/MealReports";
import { ChildStepsReport, MilestoneProgressReport } from "@/components/reports/MilestoneReports";
import ReportsHub from "@/components/reports/ReportsHub";
import StudentReportWorkspace from "@/components/reports/StudentReportWorkspace";
import { useRouter } from "next/router";

// Coach Reports: same page as the admin's (client request 2026-10-02), with
// the reports coaches can run for their centers.

const Plain = ({ children }) => children;

const REPORTS = {
  "student-performance": { label: "Student Performance", render: () => <StudentReportWorkspace /> },
  "class-performance": { label: "Class Performance", render: () => <ClassReportWorkspace /> },
  "milestone-progress": { label: "Milestone Progress Report", render: () => <MilestoneProgressReport /> },
  "child-steps": { label: "Child Steps of Progression", render: () => <ChildStepsReport /> },
  "infant-feeding-plan": { label: "Infant Feeding Plan", render: () => <InfantFeedingPlanReport /> },
  "infant-feeding": { label: "Infant Feeding Report", render: () => <InfantFeedingReport /> },
  "meal-production": { label: "Meal Production Record", render: () => <MealProductionReport /> },
  "meal-claim": { label: "Meal Claim", render: () => <MealClaimReport /> },
  "staff-performance": { label: "Staff Performance", render: () => <StaffPerformanceOverview Layout={Plain} basePath="/coach/staff-performance" /> },
  "coaching-activity": { label: "Coaching Activity", render: () => <CoachActivityReport /> },
};

const CATEGORIES = [
  { label: "Children & Development", icon: "🧒", keys: ["student-performance", "class-performance", "milestone-progress", "child-steps"] },
  { label: "Meals", icon: "🍽️", keys: ["infant-feeding-plan", "infant-feeding", "meal-production", "meal-claim"] },
  { label: "Staff", icon: "👥", keys: ["staff-performance", "coaching-activity"] },
].map((cat) => ({ ...cat, reports: cat.keys.map((key) => ({ key, label: REPORTS[key].label })) }));

export default function CoachReports() {
  const router = useRouter();
  const wanted = typeof router.query.report === "string" ? router.query.report : "";
  const key = REPORTS[wanted] ? wanted : "student-performance";
  return (
    <CoachLayout title="Reports" contentMaxWidthClassName="max-w-[1600px]">
      <ReportsHub categories={CATEGORIES} selectedKey={key} hrefFor={(k) => `/coach/reports?report=${k}`}>
        <div key={key}>{REPORTS[key].render()}</div>
      </ReportsHub>
    </CoachLayout>
  );
}
