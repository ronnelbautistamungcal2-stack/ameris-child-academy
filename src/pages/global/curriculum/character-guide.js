import { GlobalCurriculumScope } from "@/components/curriculum/CurriculumScope";
import AdminCharacterGuide from "@/pages/admin/character-guide";

// Global admin > Lesson Bank & SOP Bank > Character Guide (client sheet 10-29
// (11), row 66): the Global Character Guide, which every center imports from.
export default function GlobalCharacterGuidePage() {
  return (
    <GlobalCurriculumScope>
      <AdminCharacterGuide />
    </GlobalCurriculumScope>
  );
}
