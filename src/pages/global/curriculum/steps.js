import { GlobalCurriculumScope } from "@/components/curriculum/CurriculumScope";
import CurriculumManager from "@/pages/admin/curriculum";

// Global admin > Lesson Bank & SOP > Steps of Progression Bank (client sheet
// 10-29 (9), row 4).
export default function GlobalStepsPage() {
  return (
    <GlobalCurriculumScope>
      <CurriculumManager defaultTab="lessons" />
    </GlobalCurriculumScope>
  );
}
