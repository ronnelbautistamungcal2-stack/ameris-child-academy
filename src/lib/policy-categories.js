export const POLICY_CATEGORIES = [
  { value: "POLICY", label: "Policies & Procedures" },
  { value: "RESOURCE", label: "Additional Resources" },
];

export const DEFAULT_POLICY_CATEGORY = "POLICY";

export function normalizePolicyCategory(value, fallback = DEFAULT_POLICY_CATEGORY) {
  const raw = String(value || "").trim().toUpperCase();
  return POLICY_CATEGORIES.some((option) => option.value === raw) ? raw : fallback;
}

export function policyCategoryLabel(value) {
  const normalized = normalizePolicyCategory(value);
  return (
    POLICY_CATEGORIES.find((option) => option.value === normalized)?.label ||
    "Policies & Procedures"
  );
}
