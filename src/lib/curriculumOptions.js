// The lists on Curriculum > Categories, used by the lesson and step forms.
// TYPE stays a valid kind for lists saved before, but Type is now a fixed
// choice of curriculum types (src/lib/curriculumTypes.js, client 2026-11-07),
// so its list is no longer shown.
export const OPTION_KINDS = ["CATEGORY", "SUBJECT", "AGE_RANGE", "TYPE"];

export const OPTION_LISTS = [
  { kind: "CATEGORY", title: "Categories", column: "Category Name", search: "Search categories...", icon: "\u{1F4C1}" },
  { kind: "SUBJECT", title: "Subjects", column: "Subject Name", search: "Search subjects...", icon: "\u{1F4D8}" },
  { kind: "AGE_RANGE", title: "Age Ranges", column: "Age Range", search: "Search age ranges...", icon: "\u{1F9D2}" },
];
