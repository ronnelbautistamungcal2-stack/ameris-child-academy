/**
 * Authentication helpers for Playwright API tests.
 * Logs in via NextAuth credentials endpoint and returns session cookies.
 */

const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const authCookieCache = new Map();

/**
 * Signs in and returns the session cookie header. By default the user also
 * accepts any pending "I agree" terms (client 2026-11-11) and signs in again,
 * so portal pages open as for an established user. Pass
 * { acceptTerms: false } to keep a brand-new user's pending terms.
 */
async function getAuthCookie(request, email, password, { acceptTerms = true } = {}) {
  const cacheKey = `${PLAYWRIGHT_BASE_URL}:${email}:${acceptTerms ? "terms" : "raw"}`;
  if (authCookieCache.has(cacheKey)) {
    return authCookieCache.get(cacheKey);
  }
  let cookieHeader = await signIn(request, email);
  if (acceptTerms && (await acceptPendingTerms(request, cookieHeader))) {
    cookieHeader = await signIn(request, email);
  }
  authCookieCache.set(cacheKey, cookieHeader);
  return cookieHeader;

  async function signIn() {
    const csrfRes = await request.get("/api/auth/csrf");
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;

    const signInRes = await request.post("/api/auth/callback/credentials?json=true", {
      form: {
        csrfToken,
        email,
        password,
        callbackUrl: `${PLAYWRIGHT_BASE_URL}/dashboard`,
      },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const storageState = await request.storageState();
    const sessionCookies = (storageState.cookies || []).filter((cookie) =>
      /(?:__Secure-)?next-auth\.session-token/.test(cookie.name),
    );

    if (!sessionCookies.length) {
      const responseText = await signInRes.text().catch(() => "");
      throw new Error(
        `Login failed for ${email} - no session cookie found (${signInRes.status()}): ${responseText}`,
      );
    }

    return sessionCookies
      .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
      .join("; ");
  }
}

/** Accepts the user's pending terms; true when something was accepted. */
async function acceptPendingTerms(request, cookieHeader) {
  const res = await request.get("/api/v1/terms", { headers: { Cookie: cookieHeader }, failOnStatusCode: false });
  if (!res.ok()) return false; // a branch without terms
  const pending = (await res.json().catch(() => ({})))?.pending || [];
  if (!pending.length) return false;
  await request.post("/api/v1/terms", {
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    data: { documentIds: pending.map((d) => d.id) },
  });
  return true;
}

function getSessionCookieValue(cookieHeader) {
  const match = String(cookieHeader || "").match(
    /(?:__Secure-)?next-auth\.session-token=([^;]+)/,
  );
  if (!match) {
    throw new Error("Unable to find NextAuth session cookie");
  }
  return decodeURIComponent(match[1]);
}

function buildBrowserSessionCookie(cookieHeader) {
  const value = getSessionCookieValue(cookieHeader);
  return {
    name: "next-auth.session-token",
    value,
    url: PLAYWRIGHT_BASE_URL,
    httpOnly: true,
    sameSite: "Lax",
  };
}

async function loginAsAdmin(request) {
  return getAuthCookie(request, "admin@demo.com", "adminpass");
}

async function loginAsTeacher(request) {
  return getAuthCookie(request, "teacher@demo.com", "teacherpass");
}

async function loginAsParent(request) {
  return getAuthCookie(request, "parent@demo.com", "parentpass");
}

async function loginAsCoach(request) {
  return getAuthCookie(request, "coach@demo.com", "coachpass");
}

async function loginAsOtherStaff(request) {
  return getAuthCookie(request, "otherstaff@demo.com", "otherstaffpass");
}

async function loginAsKitchenStaff(request) {
  return getAuthCookie(request, "kitchen@demo.com", "kitchenpass");
}

async function loginAsHrStaff(request) {
  return getAuthCookie(request, "hr@demo.com", "hrpass");
}

async function loginAsStudentSupport(request) {
  return getAuthCookie(request, "support@demo.com", "supportpass");
}

module.exports = {
  getAuthCookie,
  getSessionCookieValue,
  buildBrowserSessionCookie,
  loginAsAdmin,
  loginAsTeacher,
  loginAsParent,
  loginAsCoach,
  loginAsOtherStaff,
  loginAsKitchenStaff,
  loginAsHrStaff,
  loginAsStudentSupport,
};
