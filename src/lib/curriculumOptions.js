// The lists on Curriculum > Categories, used by the lesson and step forms.
// TYPE stays a valid kind for lists saved before, but it is no longer shown:
// the Types card on that tab is the curriculum types list instead
// (CurriculumType table, /api/v1/curriculum-types; client sheet 10-29 (8), row 8).
export const OPTION_KINDS = ["CATEGORY", "SUBJECT", "AGE_RANGE", "TYPE"];

export const OPTION_LISTS = [
  { kind: "CATEGORY", title: "Categories", column: "Category Name", search: "Search categories...", icon: "\u{1F4C1}" },
  { kind: "SUBJECT", title: "Subjects", column: "Subject Name", search: "Search subjects...", icon: "\u{1F4D8}" },
  { kind: "AGE_RANGE", title: "Age Ranges", column: "Age Range", search: "Search age ranges...", icon: "\u{1F9D2}" },
];
