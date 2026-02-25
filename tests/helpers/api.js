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

async function apiDelete(request, path, cookies) {
  return request.delete(path, {
    headers: cookies ? { Cookie: cookies } : {},
  });
}

module.exports = { apiGet, apiPost, apiPut, apiPatch, apiDelete };
