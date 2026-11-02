// Class Citizenship Weight (client "Class Room Average SOP" sheet
// 2026-11-02): a citizenship grade of 5 is worth 100%; each point above 5
// adds 1% (10 = 105%) and each point below takes off 20% (1 = 20%).
// Averages between whole grades fall on the same lines.
export function citizenshipWeight(grade) {
  const g = Math.max(0, Math.min(10, Number(grade)));
  return g >= 5 ? 95 + g : g * 20;
}

/**
 * A class's Average Citizenship Grade %: each student's average grade
 * (grades: [{ childId, score }]) turned into its weight, averaged over the
 * students who have a grade. Null without any grades.
 */
export function classCitizenshipPercent(grades) {
  const byChild = new Map();
  for (const { childId, score } of grades) {
    const c = byChild.get(childId) || { sum: 0, n: 0 };
    byChild.set(childId, { sum: c.sum + score, n: c.n + 1 });
  }
  if (!byChild.size) return null;
  const total = [...byChild.values()].reduce((sum, c) => sum + citizenshipWeight(c.sum / c.n), 0);
  return Math.round(total / byChild.size);
}
