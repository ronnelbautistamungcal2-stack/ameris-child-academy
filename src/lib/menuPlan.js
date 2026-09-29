/**
 * Menu Planner structure, shared by the admin planner, the parent/kitchen
 * read-only views and the /api/v1/menus endpoint.
 *
 * Admins type a food item on each component line; the items live in the
 * MenuItem table (one row per filled line). Which lines a meal shows depends
 * on the meal pattern and the age group, following the USDA CACFP patterns
 * the center's mockups use. No line is required.
 */

export const AGE_GROUPS = [
  { key: "youngerInfants", label: "Younger Infants", range: "0–5 months", tone: "purple" },
  { key: "olderInfants", label: "Older Infants", range: "6–12 months", tone: "blue" },
  { key: "children", label: "1–12 Years", range: "", tone: "green" },
];

export const COMPONENTS = {
  breastMilkOrFormula: "Breast Milk or Formula",
  milk: "Milk",
  meatOrAlternate: "Meat/Meat Alternate",
  vegetable: "Vegetable",
  fruit: "Fruit",
  fruitOrVegetable: "Fruit or Vegetable",
  grain: "Grain",
  grains: "Grains",
};

// Lines shown per age group for each meal pattern.
const PATTERNS = {
  breakfast: {
    youngerInfants: ["breastMilkOrFormula"],
    olderInfants: ["breastMilkOrFormula", "fruitOrVegetable", "grain"],
    children: ["milk", "fruitOrVegetable", "grains"],
  },
  snack: {
    youngerInfants: ["breastMilkOrFormula"],
    olderInfants: ["breastMilkOrFormula", "fruitOrVegetable", "grain"],
    children: ["milk", "meatOrAlternate", "vegetable", "fruit", "grains"],
  },
  meal: {
    youngerInfants: ["breastMilkOrFormula"],
    olderInfants: ["breastMilkOrFormula", "meatOrAlternate", "vegetable", "fruit", "grain"],
    children: ["milk", "meatOrAlternate", "vegetable", "fruit", "grain"],
  },
};

// Quick-reference notes shown under the grid, per meal pattern.
const REQUIREMENTS = {
  breakfast: [
    ["Younger Infants (0–5 months)", "Breast Milk or Formula."],
    ["Older Infants (6–12 months)", "Breast Milk or Formula, Fruit or Vegetable, Grain."],
    ["1–12 Years", "Serve all 3 components – Milk, Fruit or Vegetable, and Grains."],
  ],
  snack: [
    ["Younger Infants (0–5 months)", "Breast Milk or Formula."],
    [
      "Older Infants (6–12 months)",
      "Select 2 components (only 1 may be a beverage): Breast Milk or Formula, Fruit or Vegetable, Grain.",
    ],
    [
      "1–12 Years",
      "Select 2 components (only 1 may be a beverage): Milk, Meat/Meat Alternate, Vegetable, Fruit, and Grains.",
    ],
  ],
  meal: [
    ["Younger Infants (0–5 months)", "Breast Milk or Formula."],
    [
      "Older Infants (6–12 months)",
      "Breast Milk or Formula, Meat/Meat Alternate, Vegetable, Fruit, and Grain.",
    ],
    ["1–12 Years", "Serve all 5 components – Milk, Meat/Meat Alternate, Vegetable, Fruit, and Grain."],
  ],
};

export const MEALS = [
  { key: "breakfast", label: "Breakfast", pattern: "breakfast", icon: "sun" },
  { key: "amSnack", label: "AM Snack", pattern: "snack", icon: "apple" },
  { key: "lunch", label: "Lunch", pattern: "meal", icon: "plate" },
  { key: "pmSnack", label: "PM Snack", pattern: "snack", icon: "cup" },
  { key: "dinner", label: "Dinner", pattern: "meal", icon: "cloche" },
  { key: "eveningSnack", label: "Evening Snack", pattern: "snack", icon: "moon" },
];

export const MAX_ITEM_LENGTH = 200;

export function getMeal(mealKey) {
  return MEALS.find((m) => m.key === mealKey) || null;
}

export function componentsFor(mealKey, ageGroupKey) {
  const meal = getMeal(mealKey);
  return (meal && PATTERNS[meal.pattern][ageGroupKey]) || [];
}

export function requirementsFor(mealKey) {
  const meal = getMeal(mealKey);
  return meal ? REQUIREMENTS[meal.pattern] : [];
}

export function isValidLine(mealKey, ageGroupKey, componentKey) {
  return componentsFor(mealKey, ageGroupKey).includes(componentKey);
}

/** Key for one line of the planner, used on both client and server. */
export function lineKey(date, meal, ageGroup, component) {
  return `${date}|${meal}|${ageGroup}|${component}`;
}

// ---- Dates -------------------------------------------------------------
// Days travel as "YYYY-MM-DD" strings so the client's local calendar day and
// the database DATE column never drift through time zones.

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return toDateKey(parseDateKey(value)) === value;
}

/** Monday of the week containing `date`. */
export function weekStartOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday–Friday of the week starting `monday`. */
export function weekDays(monday) {
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

export function formatWeekRange(monday) {
  const friday = addDays(monday, 4);
  const opts = { month: "long", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${friday.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  })}`;
}

/**
 * Today's planned menu for the dashboard card, as one row per meal with the
 * 1–12 Years items joined. `items` is the API response for that day.
 */
export function todaysMenuRows(items) {
  const rows = MEALS.map((meal) => {
    const text = componentsFor(meal.key, "children")
      .map((component) =>
        items.find(
          (i) => i.meal === meal.key && i.ageGroup === "children" && i.component === component,
        ),
      )
      .filter(Boolean)
      .map((i) => i.item)
      .join(", ");
    return { key: meal.key, label: meal.label, items: text };
  }).filter((row) => row.items);
  return rows.length ? rows : null;
}
