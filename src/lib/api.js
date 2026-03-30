export async function apiJson(url, options) {
  const { headers, timeoutMs = 30000, ...fetchOptions } = options || {};
  const hasExternalSignal = !!fetchOptions.signal;
  const canAbort = typeof AbortController !== "undefined";
  const shouldTimeout = !hasExternalSignal && canAbort && Number(timeoutMs) > 0;
  const controller = shouldTimeout ? new AbortController() : null;
  const timeoutId = shouldTimeout
    ? setTimeout(() => controller.abort(), Number(timeoutMs))
    : null;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      ...fetchOptions,
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (res.status === 204) return null;

    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      const message =
        (typeof data?.error === "string" && data.error) ||
        data?.error?.message ||
        data?.message ||
        `${res.status} ${res.statusText}`.trim();
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      err.code = data?.error?.code || null;
      err.details = data?.error?.details || null;
      throw err;
    }

    return data;
  } catch (err) {
    if (err?.name === "AbortError" && shouldTimeout) {
      throw new Error(`Request timed out after ${Number(timeoutMs)}ms`);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
