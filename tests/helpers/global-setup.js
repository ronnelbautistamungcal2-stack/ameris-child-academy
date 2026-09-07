/**
 * Playwright global setup.
 *
 * The suite runs against `next dev`, which compiles a route the first time it is
 * requested. That first compile regularly takes longer than a single test's
 * timeout, so whichever spec happens to reach a route first pays the cost and
 * fails -- while the same test passes when run on its own against an already
 * warm server. Requesting the routes the e2e specs navigate to before the run
 * starts makes that cost predictable instead of landing on an arbitrary test.
 */
const { request: playwrightRequest } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("./auth");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

// Generous: a cold compile of a heavy admin page can take well over a minute on
// a first run, and this budget is paid once rather than per test.
const WARMUP_TIMEOUT = 180000;

const WARMUP_ROUTES = [
  [
    loginAsAdmin,
    [
      "/dashboard",
      "/admin",
      "/admin/children",
      "/admin/curriculum",
      "/coach/activity-overrides",
      "/coach/carpool-report",
      "/coach/progress",
      "/coach/shifts",
      "/coach/staff-management",
      "/coach/teachers",
    ],
  ],
  [
    loginAsTeacher,
    [
      "/dashboard",
      "/teacher/calendar",
      "/teacher/children",
      "/teacher/lessons",
      "/teacher/progress",
      "/teacher/training",
    ],
  ],
  [
    loginAsParent,
    ["/dashboard", "/parent/billing", "/parent/children", "/parent/forms", "/parent/messages"],
  ],
];

module.exports = async () => {
  if (process.env.PLAYWRIGHT_SKIP_WARMUP === "1") return;

  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const started = Date.now();
  try {
    // /login is unauthenticated and compiles the shared app shell. It also doubles
    // as a reachability probe: if the server is not actually up (Playwright can
    // reuse a server that is on its way down when suites run back to back), fail
    // here with one clear message instead of letting every test report its own
    // ECONNREFUSED.
    try {
      await context.get("/login", { timeout: WARMUP_TIMEOUT });
    } catch (error) {
      throw new Error(
        `Dev server at ${BASE_URL} is not reachable (${error.message}). If a previous ` +
          "run just finished, wait for its server to exit before starting another.",
      );
    }

    for (const [login, routes] of WARMUP_ROUTES) {
      let cookies;
      try {
        cookies = await login(context);
      } catch {
        // A role that cannot log in is the tests' problem to report, not the
        // warmup's -- skip it rather than failing the whole run here.
        continue;
      }
      for (const route of routes) {
        await context
          .get(route, {
            headers: { Cookie: cookies },
            timeout: WARMUP_TIMEOUT,
            failOnStatusCode: false,
          })
          .catch(() => {});
      }
    }
  } finally {
    await context.dispose();
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`[warmup] precompiled e2e routes in ${seconds}s`);
};
