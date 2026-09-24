/**
 * Topics an admin can file a parent question under. Parents see a single
 * ordered list, so the topic is an organizing tool for the admin library
 * (filtering, colour-coding) rather than something the portal renders.
 */
export const PARENT_FAQ_TOPICS = [
  {
    id: "pickup",
    label: "Pickup & release",
    description: "Dismissal rules, guardians, and release procedures.",
  },
  {
    id: "health",
    label: "Illness & attendance",
    description: "Sick-day guidance, absences, and when children can return.",
  },
  {
    id: "billing",
    label: "Billing & payments",
    description: "Tuition, invoices, payment expectations, and account reminders.",
  },
  {
    id: "enrollment",
    label: "Enrollment & forms",
    description: "Registration, renewals, medical paperwork, and required documents.",
  },
  {
    id: "general",
    label: "General questions",
    description: "Everything else families ask about day to day.",
  },
];

export const DEFAULT_PARENT_FAQ_TOPIC = "general";

export function normalizeParentFaqTopic(value, fallback = DEFAULT_PARENT_FAQ_TOPIC) {
  const raw = String(value || "").trim().toLowerCase();
  return PARENT_FAQ_TOPICS.some((topic) => topic.id === raw) ? raw : fallback;
}

export function findParentFaqTopic(value) {
  const normalized = normalizeParentFaqTopic(value);
  return PARENT_FAQ_TOPICS.find((topic) => topic.id === normalized);
}

export function parentFaqTopicLabel(value) {
  return findParentFaqTopic(value)?.label || "General questions";
}
