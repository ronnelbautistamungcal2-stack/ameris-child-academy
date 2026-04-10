/**
 * Authentication helpers for Playwright API tests.
 * Logs in via NextAuth credentials endpoint and returns session cookies.
 */

const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const authCookieCache = new Map();

async function getAuthCookie(request, email, password) {
  const cacheKey = `${PLAYWRIGHT_BASE_URL}:${email}`;
  if (authCookieCache.has(cacheKey)) {
    return authCookieCache.get(cacheKey);
  }

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

  const cookieHeader = sessionCookies
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  authCookieCache.set(cacheKey, cookieHeader);
  return cookieHeader;
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

module.exports = {
  getAuthCookie,
  getSessionCookieValue,
  buildBrowserSessionCookie,
  loginAsAdmin,
  loginAsTeacher,
  loginAsParent,
  loginAsCoach,
};
