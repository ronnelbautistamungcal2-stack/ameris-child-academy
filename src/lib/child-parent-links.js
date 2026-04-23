import { userRoles } from "@/lib/roles";

export const MAX_LINKED_PARENT_ACCOUNTS = 2;

export const linkedParentAccountsInclude = {
  parent: { select: { id: true, name: true, email: true } },
  guardians: {
    include: {
      guardian: { select: { id: true, name: true, email: true } },
    },
  },
};

function uniqueIds(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const ids = [];
  for (const raw of source) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function normalizeLinkedParentAccountIds(value) {
  return uniqueIds(value).slice(0, MAX_LINKED_PARENT_ACCOUNTS);
}

export function isParentUser(user) {
  return userRoles(user).includes("PARENT");
}

export function getLinkedParentUsers(child) {
  const linked = [];
  const seen = new Set();

  function push(user, fallbackId) {
    const id = user?.id || fallbackId || null;
    if (!id || seen.has(id)) return;
    seen.add(id);
    linked.push({
      id,
      name: user?.name || "",
      email: user?.email || "",
    });
  }

  push(child?.parent, child?.parentId);
  for (const guardianLink of Array.isArray(child?.guardians) ? child.guardians : []) {
    push(guardianLink?.guardian, guardianLink?.guardianId);
  }

  return linked.slice(0, MAX_LINKED_PARENT_ACCOUNTS);
}

export function getLinkedParentIds(child) {
  return getLinkedParentUsers(child).map((user) => user.id);
}

export function isChildLinkedToParent(child, parentUserId) {
  if (!parentUserId) return false;
  if (child?.parentId === parentUserId) return true;
  return (Array.isArray(child?.guardians) ? child.guardians : []).some(
    (guardianLink) => guardianLink?.guardianId === parentUserId,
  );
}

export function buildParentLinkedChildWhere(parentUserId, extraWhere = undefined) {
  const parentLinkWhere = {
    OR: [
      { parentId: parentUserId },
      { guardians: { some: { guardianId: parentUserId } } },
    ],
  };

  if (!extraWhere || !Object.keys(extraWhere).length) {
    return parentLinkWhere;
  }

  return {
    AND: [extraWhere, parentLinkWhere],
  };
}

export async function resolveLinkedParentAccountIds(prismaClient, value) {
  const requestedIds = uniqueIds(value);
  if (requestedIds.length > MAX_LINKED_PARENT_ACCOUNTS) {
    throw new Error("You can link up to 2 parent accounts per child.");
  }
  if (!requestedIds.length) return [];

  const users = await prismaClient.user.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true, role: true, roles: true },
  });

  if (users.length !== requestedIds.length) {
    throw new Error("One or more selected parent accounts were not found.");
  }

  if (users.some((user) => !isParentUser(user))) {
    throw new Error("Only parent accounts can be linked to a child.");
  }

  return requestedIds;
}

export async function applyLinkedParentAccountIds(prismaClient, childId, parentAccountIds) {
  const normalizedIds = normalizeLinkedParentAccountIds(parentAccountIds);
  const primaryParentId = normalizedIds[0] || null;
  const secondaryParentId = normalizedIds[1] || null;

  const child = await prismaClient.child.findUnique({
    where: { id: childId },
    select: {
      id: true,
      guardians: {
        select: {
          guardianId: true,
          guardian: { select: { role: true, roles: true } },
        },
      },
    },
  });

  if (!child) {
    throw new Error("Child not found");
  }

  await prismaClient.child.update({
    where: { id: childId },
    data: { parentId: primaryParentId },
  });

  const managedGuardianIds = child.guardians
    .filter((guardianLink) => isParentUser(guardianLink.guardian))
    .map((guardianLink) => guardianLink.guardianId)
    .filter((guardianId) => guardianId !== secondaryParentId);

  if (managedGuardianIds.length) {
    await prismaClient.childGuardian.deleteMany({
      where: {
        childId,
        guardianId: { in: managedGuardianIds },
      },
    });
  }

  if (secondaryParentId) {
    await prismaClient.childGuardian.upsert({
      where: {
        childId_guardianId: {
          childId,
          guardianId: secondaryParentId,
        },
      },
      update: {
        relationship: "Parent",
        isPrimary: false,
        receivesUpdates: true,
      },
      create: {
        childId,
        guardianId: secondaryParentId,
        relationship: "Parent",
        isPrimary: false,
        receivesUpdates: true,
      },
    });
  }
}
