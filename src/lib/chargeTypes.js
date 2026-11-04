// Billing charge types (client request 2026-10-29). Shared by the pages and the API.

export const CHARGE_TYPES = [
  { value: "TUITION", label: "Tuition" },
  { value: "SUPPLIES", label: "Supplies" },
  { value: "OTHER", label: "Other" },
];

export function normalizeChargeType(value) {
  const v = String(value || "").toUpperCase();
  return CHARGE_TYPES.some((t) => t.value === v) ? v : "OTHER";
}

export function chargeTypeLabel(value) {
  return CHARGE_TYPES.find((t) => t.value === value)?.label || "Other";
}
