// Character Guide decision trees (client mockups 40-01..13), shared by the
// admin editor, the API and the Daily Log.
//
// Course Correction tree:
//   { intro, question: { title, prompt },
//     branches: [{ id, title, prompt, offenses: [{ id, steps: [string] }] }] }
//   A branch is a reason for the behavior; its offenses are 1st, 2nd, 3rd...
// Character Highlight tree:
//   { intro, question: { title, prompt },
//     branches: [{ id, title, prompt, praisePrompt, rewards: [string] }] }

export const COURSE_CORRECTION = "COURSE_CORRECTION";
export const CHARACTER_HIGHLIGHT = "CHARACTER_HIGHLIGHT";

export const BEHAVIOR_TYPES = [
  { value: COURSE_CORRECTION, label: "Course Correction", hint: "Behavior that needs redirection" },
  { value: CHARACTER_HIGHLIGHT, label: "Character Highlight", hint: "Positive behavior we want to encourage" },
];

export const BEHAVIOR_LEVELS = [1, 2, 3, 4];

// Branch box colours, in order (mockups: yellow, green, blue, purple).
export const BRANCH_TONES = [
  "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
  "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
  "border-sky-300 bg-sky-50 dark:bg-sky-950/30",
  "border-violet-300 bg-violet-50 dark:bg-violet-950/30",
  "border-rose-300 bg-rose-50 dark:bg-rose-950/30",
  "border-teal-300 bg-teal-50 dark:bg-teal-950/30",
];

export const DEFAULT_REWARDS = ["Verbal praise", "Classroom privilege", "Sticker or point", "Special helper job", "Note or message home"];

export function typeLabel(type) {
  return BEHAVIOR_TYPES.find((t) => t.value === type)?.label || "";
}

/** "1st Offense", "2nd Offense", ... */
export function offenseLabel(index) {
  const n = index + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${suffix} Offense`;
}

let counter = 0;
export function newId(prefix = "n") {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

/** A fresh tree for the Add Behavior / Add Character Highlight popup. */
export function emptyTree(type, name = "") {
  if (type === CHARACTER_HIGHLIGHT) {
    return {
      intro: "",
      question: { title: "Step 1: What Positive Behavior Did the Child Show?", prompt: "Describe what the child did." },
      branches: [{ id: newId("b"), title: "", prompt: "", praisePrompt: "How will you recognize the child?", rewards: [...DEFAULT_REWARDS] }],
    };
  }
  return {
    intro: "Stay calm. Ensure all children are safe.",
    question: { title: "Step 1: Determine the Reason", prompt: name ? `What best explains why the child ${name.toLowerCase()}?` : "What best explains the behavior?" },
    branches: [{ id: newId("b"), title: "", prompt: "", offenses: [{ id: newId("o"), steps: [""] }] }],
  };
}

const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const list = (v, max = 300) => (Array.isArray(v) ? v.map((s) => str(s, max)).filter(Boolean) : []);

/** Cleans a tree from the editor; drops empty boxes. */
export function normalizeTree(type, tree = {}) {
  const ids = new Set();
  const id = (value, prefix) => {
    let next = str(value, 40) || newId(prefix);
    while (ids.has(next)) next = newId(prefix);
    ids.add(next);
    return next;
  };
  const base = {
    intro: str(tree.intro),
    question: { title: str(tree.question?.title, 200), prompt: str(tree.question?.prompt) },
  };
  const branches = (Array.isArray(tree.branches) ? tree.branches : []).slice(0, 12);
  if (type === CHARACTER_HIGHLIGHT) {
    return {
      ...base,
      branches: branches
        .map((b) => ({ id: id(b.id, "b"), title: str(b.title, 120), prompt: str(b.prompt), praisePrompt: str(b.praisePrompt), rewards: list(b.rewards, 120).slice(0, 20) }))
        .filter((b) => b.title),
    };
  }
  return {
    ...base,
    branches: branches
      .map((b) => ({
        id: id(b.id, "b"),
        title: str(b.title, 120),
        prompt: str(b.prompt),
        offenses: (Array.isArray(b.offenses) ? b.offenses : [])
          .slice(0, 10)
          .map((o) => ({ id: id(o.id, "o"), steps: list(o.steps).slice(0, 15) }))
          .filter((o) => o.steps.length),
      }))
      .filter((b) => b.title),
  };
}

/** Add / Edit Behavior body. Returns { data } or { error }. */
export function parseBehavior(body = {}) {
  const type = body.type;
  if (![COURSE_CORRECTION, CHARACTER_HIGHLIGHT].includes(type)) return { error: "Choose a type" };
  const name = str(body.name, 160);
  if (!name) return { error: type === CHARACTER_HIGHLIGHT ? "Highlight name is required" : "Behavior name is required" };
  if (!body.categoryId) return { error: "Choose a category" };
  const description = str(body.description, 1000);
  if (!description) return { error: "Description is required" };
  const level = Number(body.level);
  if (!BEHAVIOR_LEVELS.includes(level)) return { error: "Choose a level" };
  const tree = normalizeTree(type, body.tree);
  if (!tree.branches.length) return { error: "Add at least one branch with a title" };
  if (type === COURSE_CORRECTION && tree.branches.some((b) => !b.offenses.length)) return { error: "Every branch needs at least one offense with steps" };
  return { data: { type, name, categoryId: String(body.categoryId), description, level, tree } };
}

/** The steps for one branch and offense of a Course Correction tree (Daily Log). */
export function stepsFor(tree, branchId, offenseIndex) {
  const branch = tree?.branches?.find((b) => b.id === branchId);
  return branch?.offenses?.[offenseIndex]?.steps || [];
}
