import { GlobalCurriculumScope } from "@/components/curriculum/CurriculumScope";
import AdminLessons from "@/pages/admin/lessons";

// Global admin > Lesson Bank & SOP > Lesson Bank (client sheet 10-29 (9), row 4).
export default function GlobalLessonBankPage() {
  return (
    <GlobalCurriculumScope>
      <AdminLessons />
    </GlobalCurriculumScope>
  );
}
