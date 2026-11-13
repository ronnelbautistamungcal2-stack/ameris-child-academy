import { loadCurriculumTypes } from "@/lib/curriculumTypesServer";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FILTER_KEYS, filterStepRows, stepBankRows, typeFilterOptions } from "@/lib/stepsBankQuery";
import { LESSON_INCLUDE } from "@/lib/lessonInclude";

/**
 * GET /api/v1/lessons/steps-page?centerId=&page=&pageSize=&q=&category=&subject=&age=&term=&type=&sort=&dir=
 * One page of the Steps of Progression Bank, filtered and sorted on the
 * server. A center can hold tens of thousands of steps (the client imported
 * ~46,000), far too many to send to the browser with their goals and links.
 * Responds { items, total, page, pageSize, facets: { category, subject, age, term, type } };
 * items carry the full lesson (goals, supplies, links) for the edit pop-up.
 */

const SORT_KEYS = new Set(["reference", "title", "category", "subject", "age", "term"]);
const PAGE_SIZES = new Set([10, 25, 50]);

function distinct(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const collator = new Intl.Collator(undefined, { numeric: true });

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const centerId = String(req.query.centerId || "");
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const pageSize = PAGE_SIZES.has(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 10;
    const sortKey = SORT_KEYS.has(req.query.sort) ? req.query.sort : "reference";
    const dir = req.query.dir === "-1" || req.query.dir === "desc" ? -1 : 1;
    // Only the columns the table shows, for every step: small enough to
    // filter and sort here even for a very large bank.
    const rows = await stepBankRows(centerId);
    const facets = Object.fromEntries(FILTER_KEYS.map((k) => [k, distinct(rows.map((r) => r[k]))]));
    // Type filter (no type, a curriculum type, or an old Type value).
    facets.type = typeFilterOptions(rows, await loadCurriculumTypes());
    const visible = filterStepRows(rows, req.query);
    const key = sortKey === "age" ? "ageSort" : sortKey;
    visible.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const cmp = typeof x === "number" ? x - y : collator.compare(String(x), String(y));
      return cmp * dir;
    });

    const total = visible.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Number.parseInt(req.query.page, 10) || 1), pages);
    const ids = visible.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
    const full = ids.length ? await prisma.lesson.findMany({ where: { id: { in: ids } }, include: LESSON_INCLUDE }) : [];
    const byId = Object.fromEntries(full.map((l) => [l.id, l]));

    return res.status(200).json({
      items: ids.map((id) => byId[id]).filter(Boolean),
      total,
      page,
      pageSize,
      facets,
    });
  } catch (e) {
    console.error("steps page error:", e);
    return res.status(500).json({ error: `Could not load the steps: ${e.message?.split("\n").pop() || "server error"}` });
  }
}
