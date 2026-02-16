function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase();
}

const SUBJECT_BY_REF = new Map([
  ["D-CO", "Cognitive"],
  ["D-CM", "Communication"],
  ["D-PD", "Physical Development"],
  ["D-SS", "Social Skills"],
  ["A-LL", "Language and Literacy"],
  ["A-LL3", "Language and Literacy"],
  ["A-MR", "Math and Reasoning"],
  ["A-M", "Math and Reasoning"],
  ["A-FA", "Fine Arts"],
  ["A-CA", "Creative Arts"],
  ["A-SC", "Science"],
  ["S-CT", "Character Development"],
  ["S-KN", "Knowledge"],
  ["S-SP", "Scriptures"],
  ["L-TT", "Task Training"],
  ["L-LS", "Life Skills"],
  ["L-PR", "Procedures"],
  ["L-HS", "Health and Safety"],
  ["L-TE", "Talent Exploration"],
  ["LL-TT", "Task Training"],
  ["LL-LS", "Life Skills"],
  ["LL-PR", "Procedures"],
  ["LL-TE", "Talent Exploration"],
  ["LL-HW", "Health and Wellness"],
  ["G-WB", "Well-being"],
  ["G-TR", "Testing / Records"],
  ["G-RG", "Regulations"],
]);

const SUBJECT_TYPO_ALIASES = new Map([
  ["langauge and literacy", "Language and Literacy"],
  ["langauage and literacy", "Language and Literacy"],
  ["language and literacy", "Language and Literacy"],
  ["mathematics and reasoning", "Math and Reasoning"],
  ["math", "Math and Reasoning"],
  ["math and reasoning", "Math and Reasoning"],
  ["communicaiton", "Communication"],
  ["communiucation", "Communication"],
  ["communciation", "Communication"],
  ["communication", "Communication"],
  ["cogntive", "Cognitive"],
  ["cognitvie", "Cognitive"],
  ["cognitivce", "Cognitive"],
  ["cognitive", "Cognitive"],
  ["fina arts", "Fine Arts"],
  ["fine arts", "Fine Arts"],
  ["creative arts", "Creative Arts"],
  ["helath and safety", "Health and Safety"],
  ["health and safety", "Health and Safety"],
  ["lifeskills", "Life Skills"],
  ["life skill", "Life Skills"],
  ["life skills", "Life Skills"],
  ["phsycial", "Physical Development"],
  ["physcial", "Physical Development"],
  ["physical", "Physical Development"],
  ["wellbeing", "Well-being"],
  ["well being", "Well-being"],
  ["well-being", "Well-being"],
  ["social", "Social Skills"],
  ["social skills", "Social Skills"],
  ["testing/records", "Testing / Records"],
  ["testing/ records", "Testing / Records"],
]);

const CANONICAL_BY_KEY = new Map(
  [...new Set([...SUBJECT_BY_REF.values(), ...SUBJECT_TYPO_ALIASES.values()])]
    .map((label) => [normalizeKey(label), label]),
);

function parseRefCode(refId) {
  const raw = normalizeSpaces(refId);
  if (!raw) return "";
  const m = raw.match(/^\d+\s*[a-zA-Z]*\.\s*([a-zA-Z]+)\s*-\s*([a-zA-Z0-9]+)\s*\./);
  if (!m) return "";
  return `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
}

function canonicalizeSubjectLabel(subject) {
  const trimmed = normalizeSpaces(subject);
  if (!trimmed) return "";
  const key = normalizeKey(trimmed);
  const aliased = SUBJECT_TYPO_ALIASES.get(key);
  if (aliased) return aliased;
  const canonical = CANONICAL_BY_KEY.get(key);
  if (canonical) return canonical;
  return trimmed;
}

export function normalizeSubjectForRef({ subject, refId }) {
  const refCode = parseRefCode(refId);
  const fromRef = refCode ? SUBJECT_BY_REF.get(refCode) : "";
  if (fromRef) return fromRef;
  return canonicalizeSubjectLabel(subject);
}

export function normalizeSubjectValue(value) {
  return canonicalizeSubjectLabel(value);
}
