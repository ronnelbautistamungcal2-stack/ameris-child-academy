/**
 * E2E test helpers for Playwright browser tests.
 */

async function loginViaUI(page, email, password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

async function loginAsAdmin(page) {
  await loginViaUI(page, "admin@demo.com", "adminpass");
}

async function loginAsTeacher(page) {
  await loginViaUI(page, "teacher@demo.com", "teacherpass");
}

async function loginAsParent(page) {
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
  loginViaUI,
  loginAsAdmin,
  loginAsTeacher,
  loginAsParent,
  expectVisible,
  waitForLoadingDone,
};
