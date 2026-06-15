import { getSession } from "@/lib/auth";
import {
  buildActiveChildFlags,
  createChildFlagSnapshot,
  filterChildFlags,
  hydrateChildFlagFromSnapshot,
  sortChildFlags,
} from "@/lib/childFlags";
import prisma from "@/lib/prisma";

function normalizeStatus(value) {
  const status = String(value || "open").toLowerCase();
  if (status === "closed" || status === "all") return status;
  return "open";
}

async function loadFlagData({ centerId = "", childId = "" } = {}) {
  const childWhere = {
    ...(centerId ? { centerId } : {}),
    ...(childId ? { id: childId } : {}),
  };

  const children = await prisma.child.findMany({
    where: childWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      allergies: true,
      healthAssessmentDocuments: true,
      enrollmentDocuments: true,
      iefDocuments: true,
      immunizationDocuments: true,
      infantDocuments: true,
      otherDocuments: true,
      centerId: true,
      classRoomId: true,
      createdAt: true,
      center: { select: { id: true, name: true } },
      classRoom: { select: { id: true, name: true } },
    },
  });

  const childIds = children.map((child) => child.id);
  const centerIds = [...new Set(children.map((child) => child.centerId).filter(Boolean))];

  const [activities, milestonePlans, reviews] = await Promise.all([
    childIds.length
      ? prisma.activityLog.findMany({
          where: {
            childId: { in: childIds },
            type: { in: ["INCIDENT", "BEHAVIOR"] },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            childId: true,
            type: true,
            details: true,
            notes: true,
            createdAt: true,
            recordedBy: { select: { id: true, name: true, email: true } },
          },
        })
      : [],
    centerIds.length
      ? prisma.milestoneChecklistPlan.findMany({
          where: {
            centerId: { in: centerIds },
            active: true,
            periodStart: { lte: new Date() },
          },
          select: {
            id: true,
            centerId: true,
            title: true,
            periodStart: true,
            items: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                title: true,
                dueAt: true,
                notes: true,
              },
            },
          },
        })
      : [],
    centerIds.length
      ? prisma.childFlagReview.findMany({
          where: {
            centerId: { in: centerIds },
            ...(childId ? { childId } : {}),
          },
          select: {
            id: true,
            centerId: true,
            childId: true,
            flagKey: true,
            snapshot: true,
            closedAt: true,
            createdAt: true,
            closedBy: { select: { id: true, name: true, email: true } },
          },
        })
      : [],
  ]);

  const itemIds = milestonePlans.flatMap((plan) =>
    (Array.isArray(plan.items) ? plan.items : []).map((item) => item.id),
  );

  const completions =
    childIds.length && itemIds.length
      ? await prisma.milestoneChecklistItemCompletion.findMany({
          where: {
            childId: { in: childIds },
            itemId: { in: itemIds },
          },
          select: {
            childId: true,
            itemId: true,
            completedAt: true,
          },
        })
      : [];

  return { children, activities, milestonePlans, completions, reviews };
}

function presentFlag(flag, review = null) {
  return {
    ...flag,
    status: review?.closedAt ? "CLOSED" : "OPEN",
    active: true,
    closedAt: review?.closedAt ? review.closedAt.toISOString() : null,
    closedBy: review?.closedBy || null,
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER";

  if (!isAdmin && !isTeacher) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Resolve teacher's allowed center IDs once upfront
  let teacherAllowedCenterIds = null;
  if (isTeacher) {
    const memberships = await prisma.centerUser.findMany({
      where: { userId: session.user.id },
      select: { centerId: true },
    });
    teacherAllowedCenterIds = memberships.map((m) => m.centerId);
  }

  if (req.method === "GET") {
    const {
      centerId = "",
      childId = "",
      classRoomId = "",
      from = "",
      to = "",
      status: rawStatus = "open",
      summaryOnly = "",
    } = req.query || {};

    // Teachers must specify a centerId they belong to
    if (isTeacher) {
      const normalizedCenterId = typeof centerId === "string" ? centerId.trim() : "";
      if (!normalizedCenterId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      if (!teacherAllowedCenterIds.includes(normalizedCenterId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const status = normalizeStatus(rawStatus);
    const data = await loadFlagData({
      centerId: typeof centerId === "string" ? centerId : "",
      childId: typeof childId === "string" ? childId : "",
    });

    const activeFlags = buildActiveChildFlags(data);
    const activeByKey = new Map(activeFlags.map((flag) => [flag.flagKey, flag]));
    const reviewByKey = new Map(
      data.reviews.map((review) => [review.flagKey, review]),
    );

    const openItems = activeFlags
      .filter((flag) => !reviewByKey.get(flag.flagKey)?.closedAt)
      .map((flag) => presentFlag(flag));

    const closedItems = [];
    for (const flag of activeFlags) {
      const review = reviewByKey.get(flag.flagKey);
      if (!review?.closedAt) continue;
      closedItems.push(presentFlag(flag, review));
    }

    for (const review of data.reviews) {
      if (!review.closedAt || activeByKey.has(review.flagKey)) continue;
      const historicalFlag = hydrateChildFlagFromSnapshot(review);
      closedItems.push({
        ...historicalFlag,
        status: "CLOSED",
        active: false,
        closedAt: review.closedAt.toISOString(),
        closedBy: review.closedBy || null,
      });
    }

    const filters = {
      childId: typeof childId === "string" ? childId : "",
      classRoomId: typeof classRoomId === "string" ? classRoomId : "",
      from: typeof from === "string" ? from : "",
      to: typeof to === "string" ? to : "",
    };

    const filteredOpenItems = sortChildFlags(filterChildFlags(openItems, filters), "open");
    const filteredClosedItems = sortChildFlags(
      filterChildFlags(closedItems, filters),
      "closed",
    );

    let items = filteredOpenItems;
    if (status === "closed") {
      items = filteredClosedItems;
    } else if (status === "all") {
      items = [...filteredOpenItems, ...filteredClosedItems];
    }

    return res.status(200).json({
      items: summaryOnly === "1" ? [] : items,
      summary: {
        openCount: filteredOpenItems.length,
        closedCount: filteredClosedItems.length,
      },
    });
  }

  if (req.method === "POST") {
    const {
      action = "close",
      flagKey = "",
      centerId = "",
      childId = "",
    } = req.body || {};

    if (!flagKey || typeof flagKey !== "string") {
      return res.status(400).json({ error: "flagKey is required" });
    }

    // Teachers may only modify flags in their assigned centers
    if (isTeacher) {
      const normalizedCenterId = typeof centerId === "string" ? centerId.trim() : "";
      if (!normalizedCenterId || !teacherAllowedCenterIds.includes(normalizedCenterId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    if (action === "close") {
      if (!centerId || !childId) {
        return res.status(400).json({ error: "centerId and childId are required to close a flag" });
      }

      const data = await loadFlagData({ centerId, childId });
      const activeFlags = buildActiveChildFlags(data);
      const targetFlag = activeFlags.find((flag) => flag.flagKey === flagKey);
      if (!targetFlag) {
        return res.status(404).json({ error: "Flag not found or no longer active" });
      }

      const review = await prisma.childFlagReview.upsert({
        where: { flagKey },
        create: {
          flagKey,
          centerId,
          childId,
          snapshot: createChildFlagSnapshot(targetFlag),
          closedAt: new Date(),
          closedById: session.user.id,
        },
        update: {
          centerId,
          childId,
          snapshot: createChildFlagSnapshot(targetFlag),
          closedAt: new Date(),
          closedById: session.user.id,
        },
        select: {
          closedAt: true,
          closedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return res.status(200).json(presentFlag(targetFlag, review));
    }

    if (action === "open") {
      const existing = await prisma.childFlagReview.findUnique({
        where: { flagKey },
        select: {
          centerId: true,
          childId: true,
        },
      });
      if (!existing) {
        return res.status(404).json({ error: "Flag review not found" });
      }

      const data = await loadFlagData({
        centerId: existing.centerId,
        childId: existing.childId,
      });
      const activeFlags = buildActiveChildFlags(data);
      const targetFlag = activeFlags.find((flag) => flag.flagKey === flagKey);
      if (!targetFlag) {
        return res.status(400).json({ error: "Flag is no longer active and cannot be reopened" });
      }

      await prisma.childFlagReview.update({
        where: { flagKey },
        data: {
          closedAt: null,
          closedById: null,
        },
      });

      return res.status(200).json(presentFlag(targetFlag));
    }

    return res.status(400).json({ error: "Unsupported action" });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
