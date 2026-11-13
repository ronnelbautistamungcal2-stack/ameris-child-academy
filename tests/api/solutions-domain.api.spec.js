// @ts-check
// amerissolutions.com opens the Ameris Solutions website at its front page
// (client 2026-11-12); other domains keep the Ameris Academy site. nginx
// passes the public host on, which the middleware reads.
const { test, expect } = require("@playwright/test");

const solutions = { "x-forwarded-host": "amerissolutions.com", "x-forwarded-proto": "https" };
const academy = { "x-forwarded-host": "amerisacademy.com" };

test.describe("Ameris Solutions domain @api", () => {
  test("the front page is the Solutions website on amerissolutions.com only", async ({ request }) => {
    const home = await request.get("/", { headers: solutions });
    expect(home.status()).toBe(200);
    expect(await home.text()).toContain("Tools for Childcare Success");

    const www = await request.get("/", { headers: { "x-forwarded-host": "www.amerissolutions.com" } });
    expect(await www.text()).toContain("Tools for Childcare Success");

    const other = await request.get("/", { headers: academy });
    expect(await other.text()).not.toContain("Tools for Childcare Success");
  });

  test("Academy contact and programs pages go to their Solutions pages on the public domain", async ({ request }) => {
    const contact = await request.get("/contact", { headers: solutions, maxRedirects: 0 });
    expect(contact.status()).toBe(307);
    expect(contact.headers().location).toBe("https://amerissolutions.com/solutions/contact");
    const programs = await request.get("/programs", { headers: solutions, maxRedirects: 0 });
    expect(programs.headers().location).toBe("https://amerissolutions.com/solutions/plans");
    // The Academy domain keeps its own pages.
    expect((await request.get("/contact", { headers: academy, maxRedirects: 0 })).status()).toBe(200);
    expect((await request.get("/login", { headers: academy, maxRedirects: 0 })).status()).toBe(200);
    // Signing out lands on /login: on amerissolutions.com that's the new
    // Solutions login, keeping the query (client sheet 10-29 (8), row 13).
    const login = await request.get("/login?callbackUrl=%2Fdashboard", { headers: solutions, maxRedirects: 0 });
    expect(login.status()).toBe(307);
    expect(login.headers().location).toBe("https://amerissolutions.com/solutions/login?callbackUrl=%2Fdashboard");
  });
});
