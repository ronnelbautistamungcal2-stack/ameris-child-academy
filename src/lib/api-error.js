const DEFAULT_MESSAGES = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  409: "Conflict",
  422: "Unprocessable entity",
  429: "Too many requests",
  500: "Internal server error",
  502: "Bad gateway",
  503: "Service unavailable",
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || DEFAULT_MESSAGES[status] || "Request failed");
    this.name = "ApiError";
    this.status = Number(status) || 500;
    this.code = code || "INTERNAL_ERROR";
    this.details = details || null;
  }
}

export function apiError(status, code, message, details) {
  return new ApiError(status, code, message, details);
}

export function badRequest(message, details, code = "BAD_REQUEST") {
  return apiError(400, code, message, details);
}

export function unauthorized(message = "Unauthorized", details) {
  return apiError(401, "UNAUTHORIZED", message, details);
}

export function forbidden(message = "Forbidden", details) {
  return apiError(403, "FORBIDDEN", message, details);
}

export function notFound(message = "Not found", details) {
  return apiError(404, "NOT_FOUND", message, details);
}

export function methodNotAllowed(allowed, message = "Method not allowed") {
  return apiError(405, "METHOD_NOT_ALLOWED", message, {
    allowed: Array.isArray(allowed) ? allowed : [],
  });
}

export function conflict(message = "Conflict", details) {
  return apiError(409, "CONFLICT", message, details);
}

export function serviceUnavailable(message = "Service unavailable", details) {
  return apiError(503, "SERVICE_UNAVAILABLE", message, details);
}

export function getErrorPayload(error) {
  const apiErr =
    error instanceof ApiError
      ? error
      : apiError(
          500,
          "INTERNAL_ERROR",
          DEFAULT_MESSAGES[500],
          process.env.NODE_ENV === "production"
            ? null
            : { cause: error?.message || String(error) },
        );

  return {
    status: apiErr.status,
    body: {
      ok: false,
      message: apiErr.message,
      error: {
        code: apiErr.code,
        message: apiErr.message,
        ...(apiErr.details ? { details: apiErr.details } : {}),
      },
    },
  };
}

export function sendApiError(res, error) {
  const payload = getErrorPayload(error);
  if (!res.headersSent && payload.status === 405 && payload.body?.error?.details?.allowed) {
    res.setHeader("Allow", payload.body.error.details.allowed);
  }
  return res.status(payload.status).json(payload.body);
}

export function createApiHandler(handler, options = {}) {
  const allowedMethods = Array.isArray(options.methods) ? options.methods : null;

  return async function apiHandler(req, res) {
    try {
      if (allowedMethods && !allowedMethods.includes(req.method)) {
        throw methodNotAllowed(allowedMethods);
      }
      return await handler(req, res);
    } catch (error) {
      const payload = getErrorPayload(error);
      if (payload.status >= 500) {
        console.error(options.logLabel || "api error:", error);
      }
      return sendApiError(res, error);
    }
  };
}
