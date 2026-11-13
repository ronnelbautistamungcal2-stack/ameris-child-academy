// Server side of subscription pricing (step G): which pricing set is in effect
// and a subscriber's price from their saved choices.
import prisma from "@/lib/prisma";
import { BILLING_CYCLES, CURRICULUM_VERSIONS, PROGRAM_TYPES, chosenDiscountId, classroomCounts, quote } from "@/lib/subscriptionPricing";
import { curriculumVersionForType } from "@/lib/curriculumTypes";

const dateKey = (d) => new Date(d).toISOString().slice(0, 10);

/** Every pricing set, newest effective date first, with `current` marked. */
export async function listPricingSets(db = prisma, today = new Date()) {
  const sets = await db.pricingSet.findMany({ orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] });
  const todayKey = dateKey(today);
  const current = sets.find((s) => dateKey(s.effectiveDate) <= todayKey) || sets[sets.length - 1] || null;
  return sets.map((s) => ({ ...s, effectiveDate: dateKey(s.effectiveDate), current: s.id === current?.id }));
}

/** The pricing set in effect today (the latest effective date on or before today). */
export async function currentPricingSet(db = prisma, today = new Date()) {
  return (await listPricingSets(db, today)).find((s) => s.current) || null;
}

const ids = (v) => (Array.isArray(v) ? [...new Set(v.map(String))].slice(0, 50) : []);

/** Tidies the pricing choices sent for a subscriber. */
export function parsePricingSelection(input) {
  const src = input && typeof input === "object" ? input : {};
  const children = src.children === "" || src.children == null ? null : Number(src.children);
  if (children !== null && (!Number.isInteger(children) || children < 1)) return { error: "Number of children must be a whole number, at least 1" };
  const pick = (value, list, fallback) => (list.some((o) => o.value === value) ? value : fallback);
  // The curriculum type chosen (Curriculum > Categories > Types; client sheet
  // 10-29 (8), rows 9/10). Its price column is Standard or Faith Based.
  const curriculumType = /^[A-Z0-9_]{1,60}$/.test(String(src.curriculumType || "")) ? String(src.curriculumType) : null;
  return {
    data: {
      children,
      billingCycle: pick(src.billingCycle, BILLING_CYCLES, "MONTHLY"),
      programType: pick(src.programType, PROGRAM_TYPES, "CENTER"),
      curriculumType,
      curriculumVersion: curriculumType ? curriculumVersionForType(curriculumType) : pick(src.curriculumVersion, CURRICULUM_VERSIONS, "STANDARD"),
      // Classrooms per age group, { key: count } (client 2026-11-11).
      classrooms: classroomCounts({ classrooms: src.classrooms, ageGroups: ids(src.ageGroups) }),
      homeDaycareProgram: src.homeDaycareProgram ? String(src.homeDaycareProgram).slice(0, 80) : null,
      // One discount at most (client 2026-11-11).
      discountId: chosenDiscountId({ discountId: src.discountId ? String(src.discountId).slice(0, 80) : null, discountIds: ids(src.discountIds) }),
      orderDate: src.orderDate ? dateKey(src.orderDate) : null,
    },
  };
}

/** A subscriber's price with the pricing set in effect, or null when there are no choices yet. */
export async function accountQuote(account, db = prisma) {
  const selection = account?.pricingSelection;
  if (!selection || !selection.children) return null;
  const set = await currentPricingSet(db);
  if (!set) return { error: "No pricing set yet. Add one under Settings > Subscription Pricing." };
  const result = quote(set.data, {
    ...selection,
    orderDate: selection.orderDate ? `${selection.orderDate}T12:00:00` : null,
    addOns: account.addOns || [],
  });
  return { ...result, pricingSet: { id: set.id, name: set.name, effectiveDate: set.effectiveDate } };
}
