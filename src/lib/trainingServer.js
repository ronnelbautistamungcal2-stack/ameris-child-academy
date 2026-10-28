// Staff training on the server: who may see or manage a center's trainings,
// loading pathways and library items, and each staff member's progress.

import { hasAccessToCenter } from "@/lib/auth";
import { EMPLOYED_WHERE } from "@/lib/employment";
import prisma from "@/lib/prisma";
import { isEmployeeRole, roleLabel, userRoles } from "@/lib/roles";
import { appliesTo, pathwayProgress, TRAINING_ROLES } from "@/lib/training";

/** Employees of the center may view; only admins add, edit or delete. */
export async function trainingAccess(session, centerId) {
  if (!session || !centerId) return { ok: false, status: 400, error: "centerId is required" };
  if (!isEmployeeRole(session.user.role)) return { ok: false, status: 403, error: "Forbidden" };
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, canManage: session.user.role === "ADMIN", canTrack: ["ADMIN", "COACH", "HR_STAFF"].includes(session.user.role) };
}

export const ITEM_INCLUDE = {
  pathways: { orderBy: { sortOrder: "asc" }, include: { pathway: { select: { id: true, title: true } } } },
};

export function serializeItem(item) {
  const { pathways, ...rest } = item;
  return {
    ...rest,
    materials: Array.isArray(item.materials) ? item.materials : [],
    dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null,
    pathways: (pathways || []).map((p) => ({ id: p.pathway.id, title: p.pathway.title })),
    pathwayIds: (pathways || []).map((p) => p.pathway.id),
  };
}

/** Currently employed staff of a center with their staff roles. */
export async function centerStaff(centerId) {
  const users = await prisma.user.findMany({
    where: {
      ...EMPLOYED_WHERE,
      centers: { some: { centerId } },
      OR: [{ role: { in: TRAINING_ROLES } }, { roles: { hasSome: TRAINING_ROLES } }],
    },
    select: { id: true, name: true, email: true, role: true, roles: true, staffDepartment: true, pictureUrl: true, hireDate: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.map((u) => {
    const roles = userRoles(u).filter((r) => TRAINING_ROLES.includes(r));
    return { ...u, roles, position: u.staffDepartment || roleLabel(roles[0] || u.role) };
  });
}

/** Pathways of a center with their trainings in order. */
export async function loadPathways(centerId, where = {}) {
  const pathways = await prisma.teacherTrainingPathway.findMany({
    where: { centerId, ...where },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { item: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { title: "asc" },
  });
  const editorIds = [...new Set(pathways.map((p) => p.updatedById).filter(Boolean))];
  const editors = editorIds.length ? await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } }) : [];
  const editorName = Object.fromEntries(editors.map((e) => [e.id, e.name]));
  return pathways.map((p) => ({
    id: p.id,
    centerId: p.centerId,
    title: p.title,
    description: p.description || "",
    category: p.category || "",
    appliesToRoles: p.appliesToRoles || [],
    ageGroups: p.ageGroups || [],
    materials: Array.isArray(p.materials) ? p.materials : [],
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    createdByName: p.createdBy?.name || "",
    updatedByName: editorName[p.updatedById] || p.createdBy?.name || "",
    items: p.items.map((pi) => serializeItem({ ...pi.item, pathways: [] })),
  }));
}

/** progressByUser[userId][itemId] for the given users and items. */
export async function loadProgress(userIds, itemIds) {
  if (!userIds.length || !itemIds.length) return {};
  const rows = await prisma.trainingProgress.findMany({ where: { userId: { in: userIds }, trainingItemId: { in: itemIds } } });
  const out = {};
  for (const r of rows) (out[r.userId] ||= {})[r.trainingItemId] = r;
  return out;
}

/** Staff Progress rows: each staff member on each active pathway that applies to them. */
export function staffProgressRows(staff, pathways, progressByUser) {
  const rows = [];
  for (const member of staff) {
    for (const p of pathways) {
      if (!p.active || !appliesTo(p, member.roles)) continue;
      const progress = pathwayProgress(p.items.map((i) => i.id), progressByUser[member.id] || {});
      rows.push({
        userId: member.id,
        name: member.name || member.email,
        role: member.position,
        roles: member.roles,
        pathwayId: p.id,
        pathway: p.title,
        category: p.category,
        required: progress.total,
        completed: progress.completed,
        pct: progress.pct,
        status: progress.status,
        lastActivity: progress.lastActivity,
      });
    }
  }
  return rows;
}

export async function validPathwayIds(centerId, input) {
  const ids = Array.isArray(input) ? [...new Set(input.map(String))] : [];
  if (!ids.length) return [];
  const found = await prisma.teacherTrainingPathway.findMany({ where: { centerId, id: { in: ids } }, select: { id: true } });
  return found.map((p) => p.id);
}

/** New trainings go to the end of each pathway's list. */
export async function linkRows(pathwayIds) {
  const rows = [];
  for (const pathwayId of pathwayIds) {
    const last = await prisma.trainingPathwayItem.findFirst({ where: { pathwayId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    rows.push({ pathwayId, sortOrder: (last?.sortOrder ?? -1) + 1 });
  }
  return rows;
}
