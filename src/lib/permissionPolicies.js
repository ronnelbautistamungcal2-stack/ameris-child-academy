export const PERMISSION_TYPE_VALUES = [
  "PHOTO_RELEASE",
  "FIELD_TRIP",
  "MEDICAL_TREATMENT",
  "TRANSPORTATION",
  "SUNSCREEN_APPLICATION",
  "WATER_ACTIVITIES",
];

export const DEFAULT_PERMISSION_POLICIES = [
  {
    value: "PHOTO_RELEASE",
    label: "Photo Release",
    description:
      "Allow photos and videos of your child for classroom updates and approved center use.",
    policySummary:
      "This permission covers photos and videos taken during classroom routines, daily updates, and other center-approved communication.",
    policySections: [
      "Media may be used for secure family updates, classroom documentation, and center communication that follows school policy.",
      "Staff will avoid sharing sensitive information alongside media and will use reasonable care when handling images or videos.",
      "Public-facing use outside standard family communication should follow the center's published policy and approval process.",
    ],
  },
  {
    value: "FIELD_TRIP",
    label: "Field Trip",
    description:
      "Allow off-campus supervised field trips and educational visits.",
    policySummary:
      "This permission allows your child to participate in supervised outings connected to classroom learning and center programming.",
    policySections: [
      "Trips are planned and supervised by staff, with attendance, transportation, and emergency information managed before departure.",
      "Families will still receive trip-specific communication when additional details, fees, or preparation are required.",
      "Granting this permission does not remove the center's responsibility to follow staffing ratios, safety procedures, and sign-out controls.",
    ],
  },
  {
    value: "MEDICAL_TREATMENT",
    label: "Medical Treatment",
    description:
      "Allow staff to authorize emergency treatment if immediate care is required.",
    policySummary:
      "This permission allows staff to act quickly if urgent medical attention is needed and a parent or guardian cannot be reached in time.",
    policySections: [
      "Emergency services or urgent care may be contacted when staff believe immediate treatment is necessary for your child's safety.",
      "The center will continue attempting to contact parents, guardians, and emergency contacts using the information on file.",
      "This permission is intended for urgent situations and does not replace normal family communication for routine care decisions.",
    ],
  },
  {
    value: "TRANSPORTATION",
    label: "Transportation",
    description:
      "Allow transport arranged by the center for approved activities.",
    policySummary:
      "This permission covers center-arranged transportation for approved activities, outings, or operational needs tied to care.",
    policySections: [
      "Transportation will follow center safety procedures, including supervision, seat-belt or restraint expectations, and trip documentation.",
      "Drivers and staff are expected to follow the center's operating and emergency procedures during transport.",
      "Families may still receive separate notice when transportation is tied to a special event or schedule change.",
    ],
  },
  {
    value: "SUNSCREEN_APPLICATION",
    label: "Sunscreen Application",
    description:
      "Allow staff to apply sunscreen during outdoor activities when appropriate.",
    policySummary:
      "This permission allows staff to apply sunscreen to help protect your child during outdoor play and other approved activities.",
    policySections: [
      "Application should follow the center's care procedures and any written family instructions provided to staff.",
      "Families should notify the center about allergies, sensitivities, or brand-specific requirements before sunscreen is used.",
      "Sunscreen use does not replace other outdoor safety practices such as shade, hydration, and routine supervision.",
    ],
  },
  {
    value: "WATER_ACTIVITIES",
    label: "Water Activities",
    description:
      "Allow supervised participation in splash play and similar activities.",
    policySummary:
      "This permission covers supervised water play such as splash pads, sprinklers, and similar center-approved activities.",
    policySections: [
      "Water activities must follow the center's staffing, supervision, and safety expectations at all times.",
      "Children may be excluded from a specific activity if staff determine the setting, behavior, or conditions are not appropriate that day.",
      "Families should communicate any health or clothing needs that staff should know before participation.",
    ],
  },
];

export const PERMISSION_GROUPS = [
  {
    id: "sharing",
    title: "Sharing and outings",
    description: "Media sharing and supervised experiences beyond the classroom.",
    tone: "sky",
    items: ["PHOTO_RELEASE", "FIELD_TRIP"],
  },
  {
    id: "care",
    title: "Health and care",
    description: "Everyday care decisions that help staff respond quickly and safely.",
    tone: "emerald",
    items: ["MEDICAL_TREATMENT", "SUNSCREEN_APPLICATION"],
  },
  {
    id: "activities",
    title: "Movement and play",
    description: "Permissions tied to transport and active play experiences.",
    tone: "amber",
    items: ["TRANSPORTATION", "WATER_ACTIVITIES"],
  },
];

export function getDefaultPermissionPolicy(permissionType) {
  return (
    DEFAULT_PERMISSION_POLICIES.find((item) => item.value === permissionType) || null
  );
}

export function mergePermissionPolicyOverride(defaults, override) {
  if (!override) return defaults;
  return {
    ...defaults,
    label: override.label || defaults.label,
    description: override.description || defaults.description,
    policySummary: override.policySummary || defaults.policySummary,
    policySections:
      Array.isArray(override.policySections) && override.policySections.length
        ? override.policySections
        : defaults.policySections,
    policyDocument: override.policyDocument || null,
  };
}
