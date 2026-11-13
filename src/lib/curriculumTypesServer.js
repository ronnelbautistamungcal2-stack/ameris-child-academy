import { hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CURRICULUM_TYPES, FAITH_BASED_TYPE, STANDARD_TYPE, TYPE_ALIASES } from "@/lib/curriculumTypes";
import { curriculumSourceCenter } from "@/lib/curriculumSource";
import { GLOBAL_ADMIN_ROLE, hasAnyRole, signedInAs } from "@/lib/roles";

// Curriculum types kept on Curriculum > Categories > Types (client sheet
// 10-29 (8), rows 8-10). One list for every center.

export const MAX_TYPE_LABEL = 80;

/** The saved types, in list order: [{ value, label, aliases }]. The starting list when none are saved. */
export async function loadCurriculumTypes(db = prisma) {
  const rows = await db.curriculumType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
  if (!rows.length) return CURRICULUM_TYPES;
  return rows.map((r) => ({ value: r.value, label: r.label, aliases: TYPE_ALIASES[r.value] || [] }));
}

/**
 * Who may add, rename and remove types: an admin of the Ameris curriculum
 * center (Global admins reach it through Lesson Bank & SOP Bank), or a Global
 * admin. Subscribers' admins only use the list.
 */
export async function canEditCurriculumTypes(user, db = prisma) {
  if (!user) return false;
  if (hasAnyRole(signedInAs(user), [GLOBAL_ADMIN_ROLE])) return true;
  if (!hasAnyRole(signedInAs(user), ["ADMIN"])) return false;
  const source = await curriculumSourceCenter(db);
  return Boolean(source && (await hasAccessToCenter(user.id, source.id)));
}

/** The types the two subscription prices are tied to can't be removed. */
export const PRICED_TYPES = [STANDARD_TYPE, FAITH_BASED_TYPE];

/** A stored value for a new type, from its name: "Montessori" -> "MONTESSORI". */
export function typeValueFor(label, taken) {
  const base = String(label).normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase().slice(0, 40) || "TYPE";
  let value = base;
  for (let n = 2; taken.has(value); n += 1) value = `${base}_${n}`;
  return value;
}

/** How many lessons and steps, plans, and subscriber accounts use a type. */
export async function curriculumTypeUse(value, db = prisma) {
  const [lessons, plans, accounts] = await Promise.all([
    db.lesson.count({ where: { types: { has: value } } }),
    db.curriculumPlan.count({ where: { type: value } }),
    db.subscriberAccount.count({ where: { curriculumTypes: { has: value } } }),
  ]);
  return { lessons, plans, accounts };
}
