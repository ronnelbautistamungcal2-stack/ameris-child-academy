import { hasAccessToCenter } from "@/lib/auth";
import { curriculumSourceCenter } from "@/lib/curriculumSource";

// Center checks for the curriculum APIs (lessons, steps, categories, goals).
// Changing curriculum data needs access to its center. Reading also allows
// the Ameris curriculum center, whose lessons every subscriber's calendar
// shows (step E).

/** True when the user may change curriculum data of this center. */
export async function canEditCurriculumCenter(user, centerId) {
  if (!user?.id || !centerId) return false;
  return hasAccessToCenter(user.id, String(centerId));
}

/** True when the user may read curriculum data of this center. */
export async function canReadCurriculumCenter(user, centerId) {
  if (await canEditCurriculumCenter(user, centerId)) return true;
  const source = await curriculumSourceCenter();
  return Boolean(source && source.id === String(centerId));
}
