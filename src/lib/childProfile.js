// Student Profile and the Edit Child tabs (client mockups 07-01..11): the
// weekly schedule, Health & Safety, the Care Plan, and the profile's Red Flags.
// Shared by the pages and the API.

export const WEEKDAYS = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
  { key: "SUNDAY", label: "Sunday", short: "Sun" },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);

/** { MONDAY: { attends, dropOff: "07:00", pickUp: "17:30" }, ... } */
export function normalizeSchedule(value) {
  const source = value && typeof value === "object" ? value : {};
  const out = {};
  for (const day of WEEKDAYS) {
    const row = source[day.key] && typeof source[day.key] === "object" ? source[day.key] : {};
    const attends = row.attends === true;
    out[day.key] = {
      attends,
      dropOff: attends && TIME.test(row.dropOff || "") ? row.dropOff : "",
      pickUp: attends && TIME.test(row.pickUp || "") ? row.pickUp : "",
    };
  }
  return out;
}

export function emptySchedule() {
  return normalizeSchedule({});
}

export function formatClock(value) {
  if (!TIME.test(value || "")) return "";
  const [h, m] = value.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Full Day (8:00 AM – 4:00 PM)" when every school day matches, else "Mon, Wed, Fri". */
export function scheduleSummary(schedule) {
  const days = WEEKDAYS.filter((d) => schedule?.[d.key]?.attends);
  if (!days.length) return "";
  const times = new Set(days.map((d) => `${schedule[d.key].dropOff}|${schedule[d.key].pickUp}`));
  const span = times.size === 1 ? [...times][0].split("|") : null;
  const weekdays = days.length === 5 && days.every((d) => !["SATURDAY", "SUNDAY"].includes(d.key));
  const which = weekdays ? "Mon – Fri" : days.map((d) => d.short).join(", ");
  if (span && span[0] && span[1]) return `${which} (${formatClock(span[0])} – ${formatClock(span[1])})`;
  return which;
}

// ---- Health & Safety -------------------------------------------------------

export const HEALTH_LIST_SIZE = 4;

export function normalizeHealthInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  const list = (items) => (Array.isArray(items) ? items : []).map((v) => text(v, 200)).filter(Boolean).slice(0, 12);
  const pediatrician = source.pediatrician && typeof source.pediatrician === "object" ? source.pediatrician : {};
  return {
    emergencyTreatmentPermission: source.emergencyTreatmentPermission === true,
    transportationPermission: source.transportationPermission === true,
    allergies: list(source.allergies),
    conditions: list(source.conditions),
    notes: text(source.notes, 2000),
    pediatrician: { name: text(pediatrician.name, 120), phone: text(pediatrician.phone, 40) },
  };
}

/** Allergies as one line, for the places that already read Child.allergies. */
export function allergyLine(healthInfo, fallback = "") {
  const list = healthInfo?.allergies || [];
  return list.length ? list.join(", ") : fallback || "";
}

// ---- Care Plan ---------------------------------------------------------------

export const FORMULA_OPTIONS = [
  { value: "CENTER_FORMULA", label: "Please give my baby the infant formula you have at the center." },
  { value: "BREASTMILK", label: "I will provide breastmilk. Please do not give formula at the center." },
  { value: "SPECIAL_FORMULA", label: "My baby has a disability and needs a special infant formula." },
  { value: "OWN_FORMULA", label: "I want to provide a different infant formula than the one you have at the center." },
];
export const FOOD_TEXTURES = ["Pureed", "Mashed", "Ground", "Finely chopped"];
export const FOOD_GROUPS = [
  { key: "grains", label: "Grains", items: ["Crackers", "Iron-fortified infant cereal", "Ready-to-eat cereal", "Bread/Toast", "Pita bread", "Soft tortilla"] },
  { key: "protein", label: "Protein Foods / Dairy", items: ["Beans", "Beef", "Pork", "Chicken", "Turkey", "Eggs", "Fish", "Cottage cheese", "Cheese", "Yogurt", "Shellfish"] },
  { key: "fruits", label: "Fruits", items: ["Apples", "Apricots", "Bananas", "Blueberries", "Mangos", "Peaches", "Pears", "Prunes", "Strawberries"] },
  { key: "vegetables", label: "Vegetables", items: ["Broccoli", "Butternut squash", "Cauliflower", "Corn", "Spinach", "Peas", "Carrots", "Sweet potatoes", "Tomatoes", "Green beans"] },
];
export const PHYSICAL_MILESTONES = ["Sitting up", "Crawling", "Walking"];

const CARE_TEXT_FIELDS = [
  "formulaChoice", "formulaBrand", "hungerCues", "bottlesPerDay", "ouncesPerBottle", "napsPerDay", "napSchedule",
  "otherFoods", "physicalOther", "diaperingNeeds", "comfortItems", "comfortTechniques", "socialNotes",
  "academicLevel", "otherInformation",
];

export function normalizeCarePlan(value) {
  const source = value && typeof value === "object" ? value : {};
  const out = {};
  for (const key of CARE_TEXT_FIELDS) out[key] = text(source[key], 1000);
  if (!FORMULA_OPTIONS.some((o) => o.value === out.formulaChoice)) out.formulaChoice = "";
  const pick = (items, allowed) => (Array.isArray(items) ? items.filter((v) => allowed.includes(v)) : []);
  out.eatingSolids = source.eatingSolids === true ? true : source.eatingSolids === false ? false : null;
  out.textures = pick(source.textures, FOOD_TEXTURES);
  out.foods = {};
  for (const group of FOOD_GROUPS) {
    out.foods[group.key] = pick(source.foods?.[group.key], group.items);
    out.foods[`${group.key}Other`] = text(source.foods?.[`${group.key}Other`], 200);
  }
  out.physicalMilestones = pick(source.physicalMilestones, PHYSICAL_MILESTONES);
  out.inDiapers = source.inDiapers === true ? true : source.inDiapers === false ? false : null;
  out.socialStyle = pick(source.socialStyle, ["NEEDS_PROMPTING", "ON_OWN"]);
  return out;
}

// ---- Red Flags -----------------------------------------------------------------

/**
 * Red flags on the profile (client 07-01, B6): allergies and the specific
 * requests from Edit Child (chronic conditions and additional health
 * information), plus the Individual Progress Plans the child has open.
 */
export function redFlags(child, openPlans = []) {
  const health = normalizeHealthInfo(child?.healthInfo);
  const flags = [];
  const allergies = health.allergies.length ? health.allergies : String(child?.allergies || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  for (const a of allergies) flags.push({ kind: "ALLERGY", text: `Allergy - ${a}` });
  for (const c of health.conditions) flags.push({ kind: "CONDITION", text: c });
  if (health.notes) flags.push({ kind: "REQUEST", text: health.notes });
  for (const plan of openPlans) flags.push({ kind: "IPP", text: `Individual Progress Plan: ${plan.title || "Open plan"}` });
  return flags;
}

const has = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);

/**
 * The Edit Child tab fields in a create/update body, ready for Prisma. Keeps
 * Child.allergies (read across the app) and Child.feedingPlan (read by the
 * feeding reports) in step with Health & Safety and the Care Plan.
 */
export function profileTabData(body, existing = {}) {
  const data = {};
  if (has(body, "schedule")) data.schedule = normalizeSchedule(body.schedule);
  if (has(body, "healthInfo")) {
    data.healthInfo = normalizeHealthInfo(body.healthInfo);
    if (!has(body, "allergies")) data.allergies = allergyLine(data.healthInfo) || null;
  }
  if (has(body, "carePlan")) {
    data.carePlan = normalizeCarePlan(body.carePlan);
    if (!has(body, "feedingPlan")) {
      const previous = existing.feedingPlan && typeof existing.feedingPlan === "object" ? existing.feedingPlan : {};
      const bottles = Number.parseInt(data.carePlan.bottlesPerDay, 10);
      const choice = FORMULA_OPTIONS.find((o) => o.value === data.carePlan.formulaChoice);
      data.feedingPlan = {
        ...previous,
        formula: data.carePlan.formulaBrand || (data.carePlan.formulaChoice === "BREASTMILK" ? "Breastmilk" : previous.formula || null),
        bottlesPerDay: Number.isFinite(bottles) ? bottles : previous.bottlesPerDay ?? null,
        bottleNotes: data.carePlan.ouncesPerBottle ? `${data.carePlan.ouncesPerBottle} oz per bottle` : previous.bottleNotes || null,
        formulaChoice: choice ? choice.value : previous.formulaChoice || null,
      };
    }
  }
  if (has(body, "outOfAreaContact")) {
    const row = body.outOfAreaContact && typeof body.outOfAreaContact === "object" ? body.outOfAreaContact : {};
    const contact = { name: text(row.name, 120), phone: text(row.phone, 40), address: text(row.address, 300) };
    data.outOfAreaContact = contact.name || contact.phone || contact.address ? contact : null;
  }
  if (has(body, "languages")) data.languages = text(body.languages, 200) || null;
  if (has(body, "photoUrl")) data.photoUrl = text(body.photoUrl, 512) || null;
  return data;
}
