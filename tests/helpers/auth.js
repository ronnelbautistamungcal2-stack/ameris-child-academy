/**
 * Authentication helpers for Playwright API tests.
 * Logs in via NextAuth credentials endpoint and returns session cookies.
 */

async function getAuthCookie(request, email, password) {
  // Get CSRF token from NextAuth
  const csrfRes = await request.get("/api/auth/csrf");
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  // Sign in with credentials
  const signInRes = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email,
      password,
      json: "true",
    },
    maxRedirects: 0,
  });

  // Extract cookies from response
  const setCookieHeader = signInRes.headers()["set-cookie"];
  if (!setCookieHeader) {
    throw new Error(`Login failed for ${email} — no set-cookie header`);
  }
  return setCookieHeader;
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

module.exports = { getAuthCookie, loginAsAdmin, loginAsTeacher, loginAsParent };
