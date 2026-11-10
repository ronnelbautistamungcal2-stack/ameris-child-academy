// The Steps of Progression Bank's rows and filters, shared by the paged list
// (/api/v1/lessons/steps-page) and Set Types for all matching steps
// (/api/v1/lessons/bulk-types). A bank can hold tens of thousands of steps, so
// only the table's columns are loaded.

import prisma from "@/lib/prisma";
import { formatStepAge } from "@/lib/progressionSteps";
import { CURRICULUM_TYPES } from "@/lib/curriculumTypes";

export const FILTER_KEYS = ["category", "subject", "age", "term"];

/**
 * Type filter values: "" all, "NONE" no type ticked, a type value
 * (NON_DENOMINATIONAL...), or "OLD:<text>" for the older single Type field.
 */
export function matchesTypeFilter(item, filter) {
  if (!filter) return true;
  const types = item.types || [];
  if (filter === "NONE") return types.length === 0;
  if (filter.startsWith("OLD:")) return (item.oldType || "") === filter.slice(4);
  return types.includes(filter);
}

/** Options for the Type filter, from the rows' types and old Type values. */
export function typeFilterOptions(items) {
  const old = [...new Set(items.map((i) => (i.oldType || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return [
    { value: "NONE", label: "No type ticked", count: items.filter((i) => !(i.types || []).length).length },
    ...CURRICULUM_TYPES.map((t) => ({ value: t.value, label: t.label, count: items.filter((i) => (i.types || []).includes(t.value)).length })),
    ...old.map((o) => ({ value: `OLD:${o}`, label: `Old Type: ${o}`, count: items.filter((i) => (i.oldType || "").trim() === o).length })),
  ];
}

function row(step) {
  return {
    id: step.id,
    reference: step.reference || "",
    title: step.title || "",
    category: step.category?.name || "",
    subject: step.subCategory || "",
    age: step.category?.ageRange || formatStepAge(step) || "",
    term: step.term || "",
    types: step.types || [],
    oldType: (step.type || "").trim(),
    ageSort: (step.ageYears ?? 99) * 12 + (step.ageMonths ?? 0),
  };
}

/** Every step of a center as table rows. */
export async function stepBankRows(centerId) {
  const steps = await prisma.lesson.findMany({
    where: { centerId, isStep: true },
    select: {
      id: true,
      reference: true,
      title: true,
      subCategory: true,
      term: true,
      types: true,
      type: true,
      ageYears: true,
      ageMonths: true,
      maxAgeYears: true,
      maxAgeMonths: true,
      category: { select: { name: true, ageRange: true } },
    },
  });
  return steps.map(row);
}

/** The rows matching the list's search and filters (query: q, category, subject, age, term, type). */
export function filterStepRows(rows, query = {}) {
  const q = String(query.q || "").trim().toLowerCase();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, String(query[k] || "")]));
  const type = String(query.type || "");
  return rows.filter(
    (r) =>
      (!q || [r.reference, r.title, r.subject, r.category].some((v) => v.toLowerCase().includes(q))) &&
      FILTER_KEYS.every((k) => !filters[k] || r[k] === filters[k]) &&
      matchesTypeFilter(r, type),
  );
}
