import { loadCurriculumTypes } from "@/lib/curriculumTypesServer";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import { normalizeCurriculumTypes } from "@/lib/curriculumTypes";
import prisma from "@/lib/prisma";
import { filterStepRows, stepBankRows } from "@/lib/stepsBankQuery";

const BATCH = 5000; // ids per statement, well under Postgres's bind limit

/**
 * POST /api/v1/lessons/bulk-types   admins
 *   { centerId, kind: "lesson" | "step", action: "add" | "remove" | "set", types: [...],
 *     ids?: [...],        the lessons or steps to change, or
 *     filter?: { q, category, subject, age, term, type } }   every step matching
 *     the Steps of Progression Bank filters (steps only; banks can hold ~46k).
 * Sets curriculum types on many lessons or steps at once (client 2026-11-10:
 * the imported bank has no types ticked). add keeps each row's other types,
 * remove takes these off, set replaces them. Responds { updated }.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change lesson types" });

    const { centerId, kind, action, ids, filter } = req.body || {};
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!(await hasAccessToCenter(session.user.id, String(centerId)))) return res.status(403).json({ error: "Forbidden" });
    if (!["lesson", "step"].includes(kind)) return res.status(400).json({ error: "kind must be lesson or step" });
    if (!["add", "remove", "set"].includes(action)) return res.status(400).json({ error: "action must be add, remove or set" });
    const allTypes = await loadCurriculumTypes();
    const ORDER = allTypes.map((t) => t.value);
    const types = normalizeCurriculumTypes(req.body?.types || [], allTypes);
    if (!types.length && action !== "set") return res.status(400).json({ error: "Choose at least one type" });

    let targetIds;
    if (Array.isArray(ids)) {
      // Only ids of this center's lessons (or steps).
      const wanted = [...new Set(ids.map(String))];
      targetIds = [];
      for (let i = 0; i < wanted.length; i += BATCH) {
        const found = await prisma.lesson.findMany({
          where: { id: { in: wanted.slice(i, i + BATCH) }, centerId: String(centerId), isStep: kind === "step" },
          select: { id: true },
        });
        targetIds.push(...found.map((l) => l.id));
      }
    } else if (filter && kind === "step") {
      targetIds = filterStepRows(await stepBankRows(String(centerId)), filter).map((r) => r.id);
    } else {
      return res.status(400).json({ error: "Send ids, or a filter for steps" });
    }

    let updated = 0;
    for (let i = 0; i < targetIds.length; i += BATCH) {
      const chunk = targetIds.slice(i, i + BATCH);
      if (action === "set") {
        updated += (await prisma.lesson.updateMany({ where: { id: { in: chunk } }, data: { types } })).count;
      } else {
        // Merge in SQL, keeping the standard type order.
        const keep =
          action === "add"
            ? prisma.$executeRaw`
                UPDATE "Lesson" SET "types" = ARRAY(
                  SELECT t FROM unnest(${ORDER}::text[]) WITH ORDINALITY AS u(t, o)
                  WHERE t = ANY("types" || ${types}::text[]) ORDER BY o)
                WHERE "id" = ANY(${chunk}::text[])`
            : prisma.$executeRaw`
                UPDATE "Lesson" SET "types" = ARRAY(
                  SELECT t FROM unnest(${ORDER}::text[]) WITH ORDINALITY AS u(t, o)
                  WHERE t = ANY("types") AND NOT (t = ANY(${types}::text[])) ORDER BY o)
                WHERE "id" = ANY(${chunk}::text[])`;
        updated += await keep;
      }
    }
    return res.status(200).json({ updated });
  } catch (e) {
    console.error("bulk types error:", e);
    return res.status(500).json({ error: "Could not change the types" });
  }
}
