// @ts-check
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

// Every sidebar link must have a page file (a placeholder counts), so the
// navigation lists never point at a 404.
const NAV_FILES = [
  "src/components/admin/adminNav.js",
  "src/components/coach/coachNav.js",
  "src/components/teacher/teacherNav.js",
  "src/components/parent/parentNav.js",
  "src/components/staff/staffNav.js",
  "src/components/subscriber/subscriberNav.js",
];

const hrefs = [
  ...new Set(
    NAV_FILES.flatMap((file) => {
      const source = fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");
      return [...source.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1]);
    }),
  ),
].sort();

const PAGES_DIR = path.join(__dirname, "..", "..", "src", "pages");

function pageExists(href) {
  const route = href.split(/[?#]/)[0].replace(/\/$/, "") || "/index";
  return [`${route}.js`, `${route}/index.js`].some((file) => fs.existsSync(path.join(PAGES_DIR, file)));
}

test.describe("Sidebar navigation @api", () => {
  test("every sidebar link has a page", () => {
    expect(hrefs.length).toBeGreaterThan(50);
    expect(hrefs.filter((href) => !pageExists(href))).toEqual([]);
  });
});
