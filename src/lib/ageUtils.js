export const AGE_GROUPS = [
  { key: "0-1", label: "0-1 year", min: 0, max: 11, tags: ["0-1", "infant"] },
  { key: "2", label: "2 years", min: 12, max: 23, tags: ["2"] },
  { key: "3", label: "3 years", min: 24, max: 35, tags: ["3"] },
  { key: "4-5", label: "4-5 years", min: 36, max: 59, tags: ["4-5", "4", "5"] },
  { key: "6-7", label: "6-7 years", min: 60, max: 83, tags: ["6-7", "6", "7"] },
  { key: "8-12", label: "8-12 years", min: 84, max: 143, tags: ["8-12", "8", "9", "10", "11", "12"] },
];

export function ageInMonths(birthDate) {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months;
}

export function ageGroupKeyFromBirthDate(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return "";
  return AGE_GROUPS.find((g) => months >= g.min && months <= g.max)?.key || "";
}

export function mapAgeRangeToGroup(ageRangeString) {
  const text = String(ageRangeString || "").trim().toLowerCase();
  if (!text) return "";
  const exact = AGE_GROUPS.find((g) => g.tags.includes(text));
  if (exact) return exact.key;
  const monthMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to|–|—)?\s*(\d+(?:\.\d+)?)?\s*(months?|mos?|mo|m)\b/g)];
  if (monthMatches.length) {
    const nums = monthMatches
      .flatMap((match) => [match[1], match[2]])
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return AGE_GROUPS.find((g) => max >= g.min && min <= g.max)?.key || "";
    }
  }
  const yearMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to|–|—)?\s*(\d+(?:\.\d+)?)?\s*(years?|yrs?|yr|y)\b/g)];
  if (yearMatches.length) {
    const nums = yearMatches
      .flatMap((match) => [match[1], match[2]])
      .filter(Boolean)
      .map((n) => Number(n) * 12)
      .filter(Number.isFinite);
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return AGE_GROUPS.find((g) => max >= g.min && min <= g.max)?.key || "";
    }
  }
  return AGE_GROUPS.find((g) => g.tags.some((tag) => text.includes(tag)))?.key || "";
}

export function formatAge(birthDate) {
  if (!birthDate) return "";
  const months = ageInMonths(birthDate);
  if (months === null || months < 0) return "";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}y`;
  return `${years}y ${rem}mo`;
}

export function childAgeGroup(child) {
  if (!child?.birthDate) return "Unknown";
  const months = ageInMonths(child.birthDate);
  if (months === null) return "Unknown";
  if (months < 12) return "0-1";
  if (months < 24) return "2";
  if (months < 36) return "3";
  if (months < 60) return "4-5";
  if (months < 84) return "6-7";
  if (months < 144) return "8-12";
  return "12+";
}
