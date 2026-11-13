import { currentPricingSet } from "@/lib/pricingServer";
import { BEST_TIMES } from "@/lib/leads";
import { loadCurriculumTypes } from "@/lib/curriculumTypesServer";

/**
 * GET /api/v1/solutions/options  (public, no sign-in)
 * The choices the Request a Quote form offers: the curriculum age groups and
 * Home Daycare programs from the pricing set in effect (names only, no
 * prices), the curriculum types (Curriculum > Categories > Types) and the
 * best times to call.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const [set, curriculumTypes] = await Promise.all([currentPricingSet(), loadCurriculumTypes()]);
  const pick = (rows) => (rows || []).map((r) => ({ key: r.key, label: r.label }));
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({
    ageGroups: pick(set?.data?.curriculumCenters),
    homeDaycarePrograms: pick(set?.data?.homeDaycare),
    curriculumTypes: curriculumTypes.map(({ value, label }) => ({ value, label })),
    bestTimes: BEST_TIMES,
  });
}
