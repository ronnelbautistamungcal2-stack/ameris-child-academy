import { GlobalCurriculumScope } from "@/components/curriculum/CurriculumScope";
import LessonPlannerPage from "@/pages/admin/curriculum/planner";

// Global admin > Lesson Bank & SOP (client sheet 10-29 (9), rows 4/5): the
// Ameris curriculum is edited here, on the same tabs Ameris Academy had
// (Lesson Planner, Lesson Bank, Categories, Steps of Progression Bank). This
// first tab is the Lesson Planner. Subscribers and Ameris Academy keep only
// the Lesson Calendar.
export default function GlobalLessonPlannerPage() {
  return (
    <GlobalCurriculumScope>
      <LessonPlannerPage />
    </GlobalCurriculumScope>
  );
}
