import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, forbidden, unauthorized } from "@/lib/api-error";
import { getBillingSummaryForCenter } from "@/lib/billing";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";

async function getAccessibleCenters(session) {
  if (session.user.role === "ADMIN") {
    return prisma.center.findMany({
      include: { subscription: true },
      orderBy: { name: "asc" },
    });
  }

  if (session.user.role === "PARENT") {
    const [children, memberships] = await Promise.all([
      prisma.child.findMany({
        where: buildParentLinkedChildWhere(session.user.id),
        select: { centerId: true },
      }),
      prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      }),
    ]);

    const centerIds = [
      ...new Set([
        ...children.map((child) => child.centerId),
        ...memberships.map((membership) => membership.centerId),
      ]),
    ];

    if (!centerIds.length) return [];

    return prisma.center.findMany({
      where: { id: { in: centerIds } },
      include: { subscription: true },
      orderBy: { name: "asc" },
    });
  }

  const memberships = await prisma.centerUser.findMany({
    where: { userId: session.user.id },
    select: { centerId: true },
  });
  const centerIds = memberships.map((membership) => membership.centerId);
  if (!centerIds.length) return [];

  return prisma.center.findMany({
    where: { id: { in: centerIds } },
    include: { subscription: true },
    orderBy: { name: "asc" },
  });
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  if (!["ADMIN", "PARENT", "TEACHER", "COACH", "SUBSCRIBER"].includes(session.user.role)) {
    throw forbidden();
  }

  const centers = await getAccessibleCenters(session);
  const billing = centers.map(getBillingSummaryForCenter);

  return res.status(200).json({
    centers: billing,
    summary: {
      totalCenters: billing.length,
      activeCenters: billing.filter((item) => item.active).length,
      portalEnabled: billing.filter((item) => item.billingPortalEnabled).length,
      paymentLinks: billing.filter((item) => item.paymentLinkEnabled).length,
    },
  });
}, { methods: ["GET"], logLabel: "billing/summary error:" });
