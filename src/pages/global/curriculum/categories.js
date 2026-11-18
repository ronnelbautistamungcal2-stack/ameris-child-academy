import { GlobalCurriculumScope } from "@/components/curriculum/CurriculumScope";
import CurriculumManager from "@/pages/admin/curriculum";

// Global admin > Lesson Bank & SOP > Categories (client sheet 10-29 (9), row 4).
export default function GlobalCategoriesPage() {
  return (
    <GlobalCurriculumScope>
      <CurriculumManager defaultTab="categories" />
    </GlobalCurriculumScope>
  );
}
