import { accessibleCenterIds, getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ageInMonths } from "@/lib/ageUtils";
import { hasAnyRole } from "@/lib/roles";

const ROLES = ["ADMIN", "COACH", "KITCHEN_STAFF"];

function feedingPlan(value) {
  const plan = value && typeof value === "object" ? value : {};
  return {
    foods: plan.foods || null,
    formula: plan.formula || null,
    bottlesPerDay: Number.isFinite(plan.bottlesPerDay) ? plan.bottlesPerDay : null,
    bottleNotes: plan.bottleNotes || null,
  };
}

/**
 * GET /api/v1/reports/infant-feeding-plan?centerId=
 * Every infant (0–11 months) at one center with the feeding plan from their
 * profile, so the report is always current. Admins, coaches and kitchen
 * staff; only the fields the kitchen needs are returned.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!hasAnyRole(session.user, ROLES)) return res.status(403).json({ error: "Forbidden" });

    const scope = await accessibleCenterIds(session.user.id);
    const centers = await prisma.center.findMany({
      where: scope ? { id: { in: scope } } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const requested = req.query.centerId ? String(req.query.centerId) : "";
    const center = requested ? centers.find((c) => c.id === requested) : centers[0];
    if (requested && !center) return res.status(403).json({ error: "You do not have access to this center" });
    if (!center) return res.status(200).json({ center: null, centers: [], classrooms: [], infants: [] });

    // Anyone born in the last year might still be under 12 months.
    const oldest = new Date();
    oldest.setFullYear(oldest.getFullYear() - 1);
    oldest.setDate(oldest.getDate() - 1);
    const [classrooms, children] = await Promise.all([
      prisma.classRoom.findMany({
        where: { centerId: center.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.child.findMany({
        where: { centerId: center.id, birthDate: { gte: oldest } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          allergies: true,
          feedingPlan: true,
          classRoomId: true,
        },
      }),
    ]);

    const infants = children
      .filter((child) => {
        const months = ageInMonths(child.birthDate);
        return months !== null && months >= 0 && months < 12;
      })
      .map((child) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        birthDate: child.birthDate,
        allergies: child.allergies,
        classRoomId: child.classRoomId,
        feedingPlan: feedingPlan(child.feedingPlan),
      }));

    return res.status(200).json({ center, centers, classrooms, infants });
  } catch (e) {
    console.error("infant feeding plan error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
