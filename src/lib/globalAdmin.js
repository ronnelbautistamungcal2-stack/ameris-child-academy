import { getSession } from "@/lib/auth";
import { ACCOUNT_STATUSES, normalizeAddOns } from "@/lib/addOns";
import { normalizeCurriculumTypes } from "@/lib/curriculumTypes";
import { isGlobalAdmin } from "@/lib/subscriberAccounts";
import { actionForMethod, can } from "@/lib/globalPermissions";
import prisma from "@/lib/prisma";

/**
 * Session of a global admin signed in as GLOBAL_ADMIN, or null after replying
 * 401/403. With `section` (one key or a list, any of which will do) the user
 * also needs that right (Permissions & Users); the action follows the request
 * method (GET view, POST add, PUT/PATCH edit, DELETE delete) unless given.
 */
export async function requireGlobalAdmin(req, res, section = null, action = null) {
  const session = await getSession(req, res);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (session.user.role !== "GLOBAL_ADMIN" || !isGlobalAdmin(session.user)) {
    res.status(403).json({ error: "Only Ameris Solutions global admins can do this" });
    return null;
  }
  if (section) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { disabled: true, globalTeamRole: true, globalPermissions: true } });
    const wanted = action || actionForMethod(req.method);
    const sections = [].concat(section);
    if (!me || me.disabled || !sections.some((s) => can(me, s, wanted))) {
      res.status(403).json({ error: "You don't have permission to do this. Ask a Global Administrator (Permissions & Users)." });
      return null;
    }
    session.user.globalTeamRole = me.globalTeamRole;
    session.user.globalPermissions = me.globalPermissions;
  }
  return session;
}

function text(value, max = 500) {
  if (value === undefined) return undefined;
  const out = String(value ?? "").trim().slice(0, max);
  return out || null;
}

function date(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function limit(value, { min, allowNull }) {
  if (value === undefined) return undefined;
  if ((value === null || value === "") && allowNull) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) return { error: true };
  return n;
}

/**
 * Validates the editable account fields. Returns { data } or { error }.
 * Fields left out of `body` are left out of `data`.
 */
export function parseAccountInput(body = {}, { create = false, types } = {}) {
  const data = {};
  const name = text(body.name, 200);
  if (create && !name) return { error: "Center or business name is required" };
  if (name !== undefined) {
    if (!name) return { error: "Name can't be empty" };
    data.name = name;
  }
  for (const key of ["contactName", "contactEmail", "phone", "address"]) {
    const value = text(body[key]);
    if (value !== undefined) data[key] = key === "contactEmail" && value ? value.toLowerCase() : value;
  }
  if (body.addOns !== undefined) data.addOns = normalizeAddOns(body.addOns);
  // The curriculum types the subscriber pays for (client 2026-11-07).
  if (body.curriculumTypes !== undefined) data.curriculumTypes = normalizeCurriculumTypes(body.curriculumTypes, types);
  // Age groups (step E): source classroom ids; checked against the database
  // by normalizeAgeGroups in the route.
  if (body.curriculumAgeGroups !== undefined) {
    data.curriculumAgeGroups = Array.isArray(body.curriculumAgeGroups) ? body.curriculumAgeGroups.map(String) : [];
  }
  if (body.status !== undefined) {
    const status = String(body.status || "").toUpperCase();
    if (!ACCOUNT_STATUSES.includes(status)) return { error: `Status must be one of ${ACCOUNT_STATUSES.join(", ")}` };
    data.status = status;
  }
  const maxCenters = limit(body.maxCenters, { min: 1, allowNull: false });
  if (maxCenters?.error) return { error: "Number of centers must be a whole number, at least 1" };
  if (maxCenters !== undefined) data.maxCenters = maxCenters;
  const maxChildren = limit(body.maxChildren, { min: 1, allowNull: true });
  if (maxChildren?.error) return { error: "Number of children must be a whole number, at least 1, or blank for no limit" };
  if (maxChildren !== undefined) data.maxChildren = maxChildren;
  for (const key of ["startDate", "renewalDate"]) {
    const value = date(body[key]);
    if (value !== undefined) data[key] = value;
  }
  if (body.autoRenew !== undefined) data.autoRenew = Boolean(body.autoRenew);
  return { data };
}
