import { badRequest } from "@/lib/api-error";

function fieldDetails(field, expected, value) {
  const actual =
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;

  return {
    field,
    expected,
    actual,
  };
}

export function ensureObject(value, field = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`, fieldDetails(field, "object", value));
  }
  return value;
}

export function requiredString(source, field, options = {}) {
  const value = source?.[field];
  if (typeof value !== "string") {
    throw badRequest(`${field} is required`, fieldDetails(field, "string", value));
  }

  const trimmed = options.trim === false ? value : value.trim();
  if (options.minLength && trimmed.length < options.minLength) {
    throw badRequest(`${field} must be at least ${options.minLength} characters`, {
      field,
      minLength: options.minLength,
    });
  }
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw badRequest(`${field} must be ${options.maxLength} characters or fewer`, {
      field,
      maxLength: options.maxLength,
    });
  }

  return trimmed;
}

export function optionalString(source, field, options = {}) {
  const value = source?.[field];
  if (value === undefined) return undefined;
  if (value === null || value === "") return options.nullable ? null : "";
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string`, fieldDetails(field, "string", value));
  }

  const trimmed = options.trim === false ? value : value.trim();
  if (!trimmed && options.nullable) return null;
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw badRequest(`${field} must be ${options.maxLength} characters or fewer`, {
      field,
      maxLength: options.maxLength,
    });
  }
  return trimmed;
}

export function requiredEnum(source, field, allowed) {
  const value = source?.[field];
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`, {
      field,
      allowed,
    });
  }
  return value;
}

export function optionalEnum(source, field, allowed) {
  const value = source?.[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`, {
      field,
      allowed,
    });
  }
  return value;
}

export function optionalBoolean(source, field) {
  const value = source?.[field];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw badRequest(`${field} must be a boolean`, fieldDetails(field, "boolean", value));
  }
  return value;
}

export function optionalNumber(source, field, options = {}) {
  const value = source?.[field];
  if (value === undefined || value === null || value === "") {
    return options.nullable ? null : undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw badRequest(`${field} must be a valid number`, fieldDetails(field, "number", value));
  }
  if (options.integer && !Number.isInteger(parsed)) {
    throw badRequest(`${field} must be an integer`, fieldDetails(field, "integer", value));
  }
  if (options.min !== undefined && parsed < options.min) {
    throw badRequest(`${field} must be at least ${options.min}`, { field, min: options.min });
  }
  if (options.max !== undefined && parsed > options.max) {
    throw badRequest(`${field} must be ${options.max} or less`, { field, max: options.max });
  }
  return parsed;
}

export function optionalDate(source, field, options = {}) {
  const value = source?.[field];
  if (value === undefined || value === null || value === "") {
    return options.nullable ? null : undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`, fieldDetails(field, "date", value));
  }
  return date;
}

export function optionalPlainObject(source, field, options = {}) {
  const value = source?.[field];
  if (value === undefined) return undefined;
  if (value === null) return options.nullable ? null : undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`, fieldDetails(field, "object", value));
  }
  return value;
}

export function optionalArray(source, field) {
  const value = source?.[field];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be an array`, fieldDetails(field, "array", value));
  }
  return value;
}
