export const MAX_PARENT_CONTACTS = 2;
export const MAX_EMERGENCY_CONTACTS = 3;

function cleanString(value, max = 120) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : "";
}

export function normalizeParentContacts(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .slice(0, MAX_PARENT_CONTACTS)
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      return {
        label: cleanString(row.label, 40) || `Parent ${index + 1}`,
        name: cleanString(row.name),
        email: cleanString(row.email),
        phone: cleanString(row.phone, 40),
      };
    })
    .filter((item) => item.name || item.email || item.phone);
}

export function normalizeEmergencyContacts(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .slice(0, MAX_EMERGENCY_CONTACTS)
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      return {
        label: cleanString(row.label, 40) || `Emergency ${index + 1}`,
        name: cleanString(row.name),
        phone: cleanString(row.phone, 40),
      };
    })
    .filter((item) => item.name || item.phone);
}

export function formatContactLine(contact, options = {}) {
  const includeEmail = options.includeEmail !== false;
  const parts = [cleanString(contact?.name)];
  if (contact?.phone) parts.push(cleanString(contact.phone, 40));
  if (includeEmail && contact?.email) parts.push(cleanString(contact.email));
  return parts.filter(Boolean).join(" · ");
}

export function buildLegacyEmergencyContact(contactsValue) {
  const first = normalizeEmergencyContacts(contactsValue)[0];
  if (!first) return null;
  return formatContactLine(first, { includeEmail: false }) || null;
}

export function getParentContacts(child) {
  const contacts = normalizeParentContacts(child?.parentContacts);
  if (contacts.length) return contacts;

  const fallbackName = cleanString(child?.parent?.name);
  const fallbackEmail = cleanString(child?.parent?.email);
  if (fallbackName || fallbackEmail) {
    return [
      {
        label: "Parent 1",
        name: fallbackName,
        email: fallbackEmail,
        phone: "",
      },
    ];
  }
  return [];
}

export function getEmergencyContacts(child) {
  const contacts = normalizeEmergencyContacts(child?.emergencyContacts);
  if (contacts.length) return contacts;

  const legacy = cleanString(child?.emergencyContact);
  if (!legacy) return [];

  return [
    {
      label: "Emergency 1",
      name: legacy,
      phone: "",
    },
  ];
}
