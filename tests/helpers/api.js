/**
 * API call helpers for Playwright tests.
 */

async function apiGet(request, path, cookies) {
  return request.get(path, {
    headers: cookies ? { Cookie: cookies } : {},
  });
}

async function apiPost(request, path, body, cookies) {
  return request.post(path, {
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    data: body,
  });
}

async function apiPut(request, path, body, cookies) {
  return request.put(path, {
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    data: body,
  });
}

async function apiPatch(request, path, body, cookies) {
  return request.patch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    data: body,
  });
}

// Deleting a center asks for the admin's password twice; the suite signs in as the demo admin.
const CENTER_DELETE_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "adminpass";

async function apiDelete(request, path, cookies, data) {
  const body = data ?? (/^\/api\/v1\/centers\/[^/?]+$/.test(path) ? { password: CENTER_DELETE_PASSWORD, confirmPassword: CENTER_DELETE_PASSWORD } : undefined);
  return request.delete(path, {
    headers: cookies ? { Cookie: cookies } : {},
    ...(body ? { data: body } : {}),
  });
}

/**
 * The seeded "Demo Center" from a /api/v1/centers response, falling back to the
 * first center. Tests must not take centers[0] blindly: the list has no fixed
 * order, and other specs create (and then delete) temporary centers while the
 * suite runs in parallel.
 */
function pickDemoCenterId(centers) {
  const list = Array.isArray(centers) ? centers : [];
  return (list.find((c) => c.name === "Demo Center") || list[0])?.id || null;
}

module.exports = { apiGet, apiPost, apiPut, apiPatch, apiDelete, pickDemoCenterId };
