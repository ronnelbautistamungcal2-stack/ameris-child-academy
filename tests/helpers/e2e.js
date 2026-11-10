/**
 * E2E test helpers for Playwright browser tests.
 */
const {
  buildBrowserSessionCookie,
  loginAsAdmin: loginAsAdminCookie,
  loginAsTeacher: loginAsTeacherCookie,
  loginAsParent: loginAsParentCookie,
} = require("./auth");

/**
 * The "I agree" terms screen (client 2026-11-11) comes up after sign-in until
 * the user has accepted the current terms; accept it and carry on.
 */
async function acceptTermsIfAsked(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  if (!new URL(page.url()).pathname.startsWith("/terms")) return;
  const boxes = page.getByRole("checkbox");
  await boxes.first().waitFor({ timeout: 30000 });
  for (const box of await boxes.all()) await box.check();
  await page.getByRole("button", { name: "I Agree" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/terms"), { timeout: 30000 });
}

async function loginViaUI(page, email, password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), {
    timeout: 30000,
  });
  await acceptTermsIfAsked(page);
}

async function loginViaApi(page, request, email, password) {
  const { getAuthCookie } = require("./auth");
  const setCookieHeader = await getAuthCookie(request, email, password);
  const sessionCookie = buildBrowserSessionCookie(setCookieHeader);
  await page.context().addCookies([sessionCookie]);
  await page.goto("/dashboard");
  await acceptTermsIfAsked(page);
}

async function loginAsAdmin(page, request) {
  if (request) {
    const setCookieHeader = await loginAsAdminCookie(request);
    await page.context().addCookies([buildBrowserSessionCookie(setCookieHeader)]);
    await page.goto("/dashboard");
  await acceptTermsIfAsked(page);
    return;
  }
  await loginViaUI(page, "admin@demo.com", "adminpass");
}

async function loginAsTeacher(page, request) {
  if (request) {
    const setCookieHeader = await loginAsTeacherCookie(request);
    await page.context().addCookies([buildBrowserSessionCookie(setCookieHeader)]);
    await page.goto("/dashboard");
  await acceptTermsIfAsked(page);
    await page.waitForURL(/\/teacher\/dashboard(?:\?.*)?$/, { timeout: 30000 });
    return;
  }
  await loginViaUI(page, "teacher@demo.com", "teacherpass");
  await page.waitForURL(/\/teacher\/dashboard(?:\?.*)?$/, { timeout: 30000 });
}

async function loginAsParent(page, request) {
  if (request) {
    const setCookieHeader = await loginAsParentCookie(request);
    await page.context().addCookies([buildBrowserSessionCookie(setCookieHeader)]);
    await page.goto("/dashboard");
  await acceptTermsIfAsked(page);
    return;
  }
  await loginViaUI(page, "parent@demo.com", "parentpass");
}

async function expectVisible(page, text, options = {}) {
  const locator = page.getByText(text, { exact: false });
  await locator.first().waitFor({ state: "visible", timeout: 10000, ...options });
}

async function waitForLoadingDone(page) {
  // Wait for common loading indicators to disappear
  const loadingTexts = page.getByText(/^Loading/);
  try {
    await loadingTexts.first().waitFor({ state: "hidden", timeout: 10000 });
  } catch {
    // Loading already gone or never appeared
  }
}

module.exports = {
  acceptTermsIfAsked,
  loginViaApi,
  loginViaUI,
  loginAsAdmin,
  loginAsTeacher,
  loginAsParent,
  expectVisible,
  waitForLoadingDone,
};
