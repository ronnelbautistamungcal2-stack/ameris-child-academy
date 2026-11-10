// Subscription pricing (client 2026-11-10, step G). Shared by the browser and
// the server, so no imports with side effects. Money is worked out in cents.
//
// A pricing set's sheet:
//   baseRanges: [{ from, to, price }]            price per child
//   addOns: { STEPS_OF_PROGRESSION, TEACHER_TRAINING, STAFF_MANAGEMENT }  price per child
//   curriculumCenters: [{ key, label, standard, faithBased }]  price per classroom (age group)
//   homeDaycare: [{ key, label, standard, faithBased }]        price per program
//   discounts: [{ id, name, type: "PERCENT", amount, appliesTo: "ALL" | "BASE", active }]
//
// The client's rules:
// - Base: the range that holds the subscriber's number of children; charge
//   the range's top number (its "To") x that range's price per child.
// - Add-ons: the same top number x the add-on's price per child.
// - Curriculum: centers pay the age group's price per classroom x the number
//   of classrooms in that age group (client 2026-11-11), Standard or Faith
//   Based; a Home Daycare pays its program's price.
// - Discounts: one at most (they can't be combined, client 2026-11-11), a
//   percentage off. "All Packages" = off the whole monthly price; "Base
//   Program" = off the base price only.
// - Monthly or annual; annual = 12 months. Ordering on or before the 15th pays
//   the full first month, after the 15th half of it (client 2026-11-11).

export const PRICED_ADD_ONS = [
  { key: "STEPS_OF_PROGRESSION", label: "Steps of Progression" },
  { key: "TEACHER_TRAINING", label: "Teacher Training" },
  { key: "STAFF_MANAGEMENT", label: "Staff Management" },
];

export const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

export const PROGRAM_TYPES = [
  { value: "CENTER", label: "Center" },
  { value: "HOME_DAYCARE", label: "Home Daycare" },
];

export const CURRICULUM_VERSIONS = [
  { value: "STANDARD", label: "Standard" },
  { value: "FAITH_BASED", label: "Faith Based" },
];

export const DISCOUNT_APPLIES_TO = [
  { value: "ALL", label: "All Packages" },
  { value: "BASE", label: "Base Program" },
];

/** The sheet from the client's mockup (2026-11-10), used for the first set. */
export const DEFAULT_PRICING = {
  baseRanges: [
    { from: 1, to: 10, price: 24.9 },
    { from: 11, to: 20, price: 17.45 },
    { from: 21, to: 30, price: 14.97 },
    { from: 31, to: 50, price: 11.98 },
    { from: 51, to: 100, price: 9.99 },
    { from: 101, to: 150, price: 9.33 },
    { from: 151, to: 200, price: 8.5 },
    { from: 201, to: 300, price: 7.66 },
    { from: 301, to: 400, price: 6.6 },
    { from: 401, to: 500, price: 6.6 },
    { from: 501, to: 600, price: 6.33 },
  ],
  addOns: { STEPS_OF_PROGRESSION: 1.35, TEACHER_TRAINING: 1.25, STAFF_MANAGEMENT: 1.0 },
  curriculumCenters: [
    { key: "infants", label: "Infants", standard: 79, faithBased: 79 },
    { key: "toddlers", label: "Toddlers", standard: 79, faithBased: 79 },
    { key: "2-years", label: "2 Years", standard: 79, faithBased: 79 },
    { key: "3-years", label: "3 Years", standard: 89, faithBased: 89 },
    { key: "4-years", label: "4 Years", standard: 89, faithBased: 89 },
    { key: "5-years", label: "5 Years", standard: 89, faithBased: 89 },
    { key: "6-12-years", label: "6 – 12 Years", standard: 99, faithBased: 99 },
  ],
  homeDaycare: [
    { key: "early-learning", label: "Early Learning (Ages 0 – 5)", standard: 49, faithBased: 49 },
    { key: "school-age", label: "School Age (Ages 6 – 12)", standard: 59, faithBased: 59 },
    { key: "combined", label: "Combined (Ages 0 – 12)", standard: 69, faithBased: 69 },
  ],
  discounts: [
    { id: "dccs", name: "DCCS", type: "PERCENT", amount: 50, appliesTo: "ALL", active: true },
    { id: "conference", name: "Conference", type: "PERCENT", amount: 25, appliesTo: "ALL", active: true },
    { id: "yearly", name: "Yearly (Annual)", type: "PERCENT", amount: 15, appliesTo: "ALL", active: true },
    { id: "seasonal", name: "Seasonal", type: "PERCENT", amount: 15, appliesTo: "ALL", active: true },
  ],
};

const cents = (dollars) => Math.round(Number(dollars || 0) * 100);
export const money = (c) =>
  `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const price = (v) => Math.round(num(v) * 100) / 100;
const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

/**
 * Checks and tidies a sheet from the settings page. Returns { data } or
 * { error } with a message the page can show.
 */
export function validatePricing(input) {
  const src = input && typeof input === "object" ? input : {};
  const ranges = (Array.isArray(src.baseRanges) ? src.baseRanges : [])
    .map((r) => ({ from: num(r.from), to: num(r.to), price: price(r.price) }))
    .sort((a, b) => a.from - b.from);
  if (!ranges.length) return { error: "Add at least one Base Program range" };
  for (const [i, r] of ranges.entries()) {
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 1 || r.to < r.from) {
      return { error: `Range ${i + 1}: From and To must be whole numbers, To at least From` };
    }
    if (!(r.price >= 0)) return { error: `Range ${r.from}–${r.to}: enter a price per child` };
    if (i && r.from <= ranges[i - 1].to) return { error: `Ranges ${ranges[i - 1].from}–${ranges[i - 1].to} and ${r.from}–${r.to} overlap` };
  }
  const addOns = {};
  for (const a of PRICED_ADD_ONS) {
    const p = price(src.addOns?.[a.key] ?? 0);
    if (!(p >= 0)) return { error: `${a.label}: enter a price per child` };
    addOns[a.key] = p;
  }
  const rows = (list, what) => {
    const out = [];
    const seen = new Set();
    for (const r of Array.isArray(list) ? list : []) {
      const label = String(r.label || "").trim().slice(0, 80);
      if (!label) return { error: `${what}: every row needs a name` };
      const standard = price(r.standard);
      const faithBased = price(r.faithBased);
      if (!(standard >= 0) || !(faithBased >= 0)) return { error: `${what} ${label}: enter both prices` };
      let key = String(r.key || "").trim() || slug(label);
      while (seen.has(key)) key = `${key}-2`;
      seen.add(key);
      out.push({ key, label, standard, faithBased });
    }
    return { rows: out };
  };
  const centers = rows(src.curriculumCenters, "Curriculum – Centers");
  if (centers.error) return centers;
  const home = rows(src.homeDaycare, "Curriculum – Home Daycare");
  if (home.error) return home;
  const discounts = [];
  const ids = new Set();
  for (const d of Array.isArray(src.discounts) ? src.discounts : []) {
    const name = String(d.name || "").trim().slice(0, 60);
    if (!name) return { error: "Every discount needs a name" };
    const amount = Math.round(num(d.amount) * 100) / 100;
    if (!(amount >= 0 && amount <= 100)) return { error: `${name}: the percentage must be between 0 and 100` };
    let id = String(d.id || "").trim() || slug(name);
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    discounts.push({
      id,
      name,
      type: "PERCENT",
      amount,
      appliesTo: d.appliesTo === "BASE" ? "BASE" : "ALL",
      active: d.active !== false,
    });
  }
  return { data: { baseRanges: ranges, addOns, curriculumCenters: centers.rows, homeDaycare: home.rows, discounts } };
}

/** The base range that holds `children`, or null. */
export function rangeFor(pricing, children) {
  const n = Number(children);
  if (!Number.isInteger(n) || n < 1) return null;
  return (pricing?.baseRanges || []).find((r) => n >= r.from && n <= r.to) || null;
}

/** Orders after this day of the month pay half the first month (the 15th itself pays in full). */
export const FULL_MONTH_THROUGH_DAY = 15;

/** Classrooms per center age group: { key: count }; older saves had a list of keys (one each). */
export function classroomCounts(choice) {
  if (choice?.classrooms && typeof choice.classrooms === "object") {
    return Object.fromEntries(
      Object.entries(choice.classrooms)
        .map(([k, v]) => [k, Number(v)])
        .filter(([, v]) => Number.isInteger(v) && v > 0),
    );
  }
  return Object.fromEntries((choice?.ageGroups || []).map((k) => [k, 1]));
}

/** The one discount chosen (discountId); older saves had a list. */
export function chosenDiscountId(choice) {
  return choice?.discountId || (choice?.discountIds || [])[0] || null;
}

/**
 * The price for a subscriber's choices:
 *   { children, billingCycle, programType, curriculumVersion, classrooms,
 *     homeDaycareProgram, discountId, addOns, orderDate }
 * Returns { error } or { range, lines, subtotal, discounts, monthly,
 * periodTotal, firstPayment, firstPaymentNote } (amounts in cents).
 */
export function quote(pricing, choice = {}) {
  const children = Number(choice.children);
  if (!Number.isInteger(children) || children < 1) return { error: "Enter how many children they have" };
  const range = rangeFor(pricing, children);
  if (!range) {
    const top = Math.max(0, ...(pricing?.baseRanges || []).map((r) => r.to));
    return { error: children > top ? `${children} children is more than the highest range (${top}). Add a range on the Settings page.` : "No range covers that number of children" };
  }
  const billed = range.to;
  const lines = [];
  lines.push({ kind: "BASE", label: `Base Program (${range.from}–${range.to} children)`, detail: `${billed} × ${money(cents(range.price))}`, amount: billed * cents(range.price) });

  const addOns = new Set(choice.addOns || []);
  for (const a of PRICED_ADD_ONS) {
    if (!addOns.has(a.key)) continue;
    const per = cents(pricing?.addOns?.[a.key]);
    lines.push({ kind: "ADD_ON", label: a.label, detail: `${billed} × ${money(per)}`, amount: billed * per });
  }

  if (addOns.has("CURRICULUM")) {
    const faith = choice.curriculumVersion === "FAITH_BASED";
    const version = faith ? "Faith Based" : "Standard";
    if (choice.programType === "HOME_DAYCARE") {
      const program = (pricing?.homeDaycare || []).find((p) => p.key === choice.homeDaycareProgram);
      if (program) {
        lines.push({ kind: "CURRICULUM", label: `Curriculum – ${program.label}`, detail: version, amount: cents(faith ? program.faithBased : program.standard) });
      }
    } else {
      const counts = classroomCounts(choice);
      for (const g of pricing?.curriculumCenters || []) {
        const n = counts[g.key];
        if (!n) continue;
        const per = cents(faith ? g.faithBased : g.standard);
        lines.push({
          kind: "CURRICULUM",
          label: `Curriculum – ${g.label}`,
          detail: `${version}, ${n} classroom${n === 1 ? "" : "s"} × ${money(per)}`,
          amount: n * per,
        });
      }
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const baseAmount = lines[0].amount;
  const chosen = chosenDiscountId(choice);
  const discounts = (pricing?.discounts || [])
    .filter((d) => d.active && d.id === chosen)
    .map((d) => {
      const on = d.appliesTo === "BASE" ? baseAmount : subtotal;
      return { id: d.id, label: `${d.name} (${d.amount}% off ${d.appliesTo === "BASE" ? "Base Program" : "all packages"})`, amount: -Math.round((on * d.amount) / 100) };
    });
  const monthly = Math.max(0, subtotal + discounts.reduce((s, d) => s + d.amount, 0));
  const annual = choice.billingCycle === "ANNUAL";
  const periodTotal = annual ? monthly * 12 : monthly;

  let firstPayment = periodTotal;
  let firstPaymentNote = annual ? "12 months" : "Full month";
  const day = choice.orderDate ? new Date(choice.orderDate).getDate() : null;
  if (!annual && day && day > FULL_MONTH_THROUGH_DAY) {
    firstPayment = Math.round(monthly / 2);
    firstPaymentNote = `Half month (ordered after the ${FULL_MONTH_THROUGH_DAY}th)`;
  }
  return { range, billedChildren: billed, lines, subtotal, discounts, monthly, periodTotal, firstPayment, firstPaymentNote };
}
