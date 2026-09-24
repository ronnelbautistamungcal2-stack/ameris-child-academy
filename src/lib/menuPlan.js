/**
 * Published meal plan used by the parent dashboard and the Menus page.
 *
 * There is no menu-management screen (or Menu table) yet, so the rotation the
 * center serves lives here. Edit WEEKLY_MENU to change what families see; when
 * a day has no entry the UI falls back to a "not posted yet" state instead of
 * showing meals that were never planned.
 */

export const MEAL_SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "amSnack", label: "AM Snack" },
  { key: "lunch", label: "Lunch" },
  { key: "pmSnack", label: "PM Snack" },
  { key: "dinner", label: "Dinner" },
];

// Keyed by JavaScript day-of-week (0 = Sunday).
export const WEEKLY_MENU = {
  1: {
    breakfast: "Pancakes, Peaches, Milk",
    amSnack: "Bananas & Graham Crackers",
    lunch: "Baked Ziti, Garden Salad, Pears, Milk",
    pmSnack: "Cheese Cubes & Crackers",
    dinner: "Beef Stew, Dinner Rolls, Carrots, Fruit",
  },
  2: {
    breakfast: "Oatmeal, Bananas, Milk",
    amSnack: "Apples & Cheese",
    lunch: "Chicken, Rice, Broccoli, Oranges, Milk",
    pmSnack: "Yogurt & Granola",
    dinner: "Turkey, Mashed Potatoes, Green Beans, Fruit",
  },
  3: {
    breakfast: "Scrambled Eggs, Toast, Milk",
    amSnack: "Blueberry Muffins & Milk",
    lunch: "Turkey Wraps, Corn, Applesauce, Milk",
    pmSnack: "Trail Mix & Raisins",
    dinner: "Spaghetti, Green Beans, Garlic Bread, Fruit",
  },
  4: {
    breakfast: "Cereal, Strawberries, Milk",
    amSnack: "Yogurt & Berries",
    lunch: "Chicken Quesadillas, Black Beans, Melon, Milk",
    pmSnack: "Veggie Sticks & Hummus",
    dinner: "Baked Fish, Rice Pilaf, Peas, Fruit",
  },
  5: {
    breakfast: "Waffles, Mixed Fruit, Milk",
    amSnack: "Cheese Sticks & Pretzels",
    lunch: "Cheese Pizza, Side Salad, Pineapple, Milk",
    pmSnack: "Popcorn & Apple Slices",
    dinner: "Chicken Noodle Soup, Crackers, Fruit Cup",
  },
};

/**
 * Returns the meal rows for a date, or null when nothing is published for it.
 */
export function getMenuForDate(date = new Date()) {
  const day = date instanceof Date ? date.getDay() : new Date(date).getDay();
  const menu = WEEKLY_MENU[day];
  if (!menu) return null;

  const rows = MEAL_SLOTS.map((slot) => ({
    key: slot.key,
    label: slot.label,
    items: menu[slot.key] || "",
  })).filter((row) => row.items);

  return rows.length ? rows : null;
}
