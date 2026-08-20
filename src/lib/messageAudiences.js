import { userRoles } from "@/lib/roles";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { isAccommodationThread } from "@/lib/messageWorkflows";

export const MESSAGE_AUDIENCE_OPTIONS = [
  {
    key: "ALL_STAFF",
    label: "All Staff",
    description: "Teachers, coaches, and other staff",
  },
  {
    key: "ALL_TEACHERS",
    label: "All Teachers",
    description: "Teachers only",
  },
  {
    key: "ALL_PARENTS",
    label: "All Parents",
    description: "Parents linked to children in scope",
  },
  {
    key: "ALL_ADMINS",
    label: "All Admins",
    description: "Administrative team",
  },
  {
    key: "ALL_COACHES",
    label: "All Coaches",
    description: "Coaching team",
  },
];

function makeAudienceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAudienceKey(value) {
  return String(value || "").trim().toUpperCase();
}

function buildRoleMembershipWhere(roles, centerIds = []) {
  const normalizedRoles = Array.isArray(roles)
    ? [...new Set(roles.map((role) => String(role || "").trim().toUpperCase()).filter(Boolean))]
    : [];

  if (!normalizedRoles.length) {
    return null;
  }

  const roleMatch = {
    OR: [
      { role: { in: normalizedRoles } },
      { roles: { hasSome: normalizedRoles } },
      { centers: { some: { role: { in: normalizedRoles } } } },
    ],
  };

  if (!centerIds.length) {
    return roleMatch;
  }

  return {
    AND: [
      roleMatch,
      {
        centers: {
          some: {
            centerId: { in: centerIds },
          },
        },
      },
    ],
  };
}

export function canUseMessageAudiences(user) {
  const roles = userRoles(user);
  return !roles.includes("PARENT") && !roles.includes("SUBSCRIBER");
}

export function getMessageAudienceOption(key) {
  return (
    MESSAGE_AUDIENCE_OPTIONS.find((option) => option.key === normalizeAudienceKey(key)) ||
    null
  );
}

export async function getAllowedMessagingCenterIds(prismaClient, user) {
  if (user.role === "ADMIN") {
    const centers = await prismaClient.center.findMany({ select: { id: true } });
    return centers.map((center) => center.id);
  }

  if (user.role === "PARENT") {
    const children = await prismaClient.child.findMany({
      where: buildParentLinkedChildWhere(user.id),
      select: { centerId: true },
    });
    return [...new Set(children.map((child) => child.centerId).filter(Boolean))];
  }

  const memberships = await prismaClient.centerUser.findMany({
    where: { userId: user.id },
    select: { centerId: true },
  });

  return [...new Set(memberships.map((membership) => membership.centerId).filter(Boolean))];
}

async function resolveUsersForRoles(prismaClient, roles, centerIds, excludeUserId) {
  const where = buildRoleMembershipWhere(roles, centerIds);
  if (!where) return [];

  const users = await prismaClient.user.findMany({
    where: {
      id: { not: excludeUserId },
      ...where,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      pictureUrl: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => String(role || "").trim().toUpperCase())
    : [];

  return users.map((user) => {
    const heldRoles = userRoles(user);
    const asRole = normalizedRoles.find((role) => heldRoles.includes(role)) || null;
    return { ...user, asRole };
  });
}

async function resolveParents(prismaClient, centerIds, excludeUserId) {
  const centerWhere = centerIds.length
    ? {
        OR: [
          { children: { some: { centerId: { in: centerIds } } } },
          { guardianships: { some: { child: { centerId: { in: centerIds } } } } },
        ],
      }
    : {};

  const users = await prismaClient.user.findMany({
    where: {
      id: { not: excludeUserId },
      OR: [{ role: "PARENT" }, { roles: { has: "PARENT" } }],
      ...centerWhere,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      pictureUrl: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.map((user) => ({ ...user, asRole: "PARENT" }));
}

export async function resolveMessageAudienceUsers({
  prismaClient,
  user,
  audienceKey,
  centerId,
  threadType,
}) {
  const option = getMessageAudienceOption(audienceKey);
  if (!option) {
    throw makeAudienceError("Invalid audience selection.");
  }

  if (!canUseMessageAudiences(user)) {
    throw makeAudienceError("This account cannot send role-based group messages.", 403);
  }

  const normalizedCenterId = String(centerId || "").trim();
  let scopedCenterIds = [];

  if (normalizedCenterId) {
    if (user.role === "ADMIN") {
      scopedCenterIds = [normalizedCenterId];
    } else {
      const allowedCenterIds = await getAllowedMessagingCenterIds(prismaClient, user);
      if (!allowedCenterIds.includes(normalizedCenterId)) {
        throw makeAudienceError("Forbidden", 403);
      }
      scopedCenterIds = [normalizedCenterId];
    }
  } else if (user.role !== "ADMIN") {
    scopedCenterIds = await getAllowedMessagingCenterIds(prismaClient, user);
  }

  const accommodationThread = isAccommodationThread(threadType);
  if (
    accommodationThread &&
    !["ALL_STAFF", "ALL_TEACHERS"].includes(option.key)
  ) {
    throw makeAudienceError(
      "Accommodations can only be sent to teachers or staff.",
    );
  }

  switch (option.key) {
    case "ALL_STAFF":
      return resolveUsersForRoles(
        prismaClient,
        accommodationThread
          ? ["TEACHER", "OTHER_STAFF"]
          : ["TEACHER", "OTHER_STAFF", "COACH"],
        scopedCenterIds,
        user.id,
      );
    case "ALL_TEACHERS":
      return resolveUsersForRoles(prismaClient, ["TEACHER"], scopedCenterIds, user.id);
    case "ALL_COACHES":
      return resolveUsersForRoles(prismaClient, ["COACH"], scopedCenterIds, user.id);
    case "ALL_ADMINS":
      return resolveUsersForRoles(prismaClient, ["ADMIN"], [], user.id);
    case "ALL_PARENTS":
      return resolveParents(prismaClient, scopedCenterIds, user.id);
    default:
      throw makeAudienceError("Invalid audience selection.");
  }
}
