import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const user = session.user;
  const { status = "all" } = req.query;

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Base filter: only submissions with expiresAt set and not renewed
  const where = { expiresAt: { not: null }, renewedById: null };

  // Role-based scope
  if (user.role !== "ADMIN") {
    where.submittedById = user.id;
  }

  // Status filter
  if (status === "expiring") {
    where.expiresAt = { lte: thirtyDaysFromNow, gte: now };
  } else if (status === "expired") {
    where.expiresAt = { lt: now };
  }

  const submissions = await prisma.formSubmission.findMany({
    where,
    include: {
      template: true,
      child: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: 200,
  });

  // Add computed status field
  const results = submissions.map((s) => {
    let renewalStatus = "active";
    if (s.expiresAt) {
      if (new Date(s.expiresAt) < now) renewalStatus = "expired";
      else if (new Date(s.expiresAt) <= thirtyDaysFromNow) renewalStatus = "expiring";
    }
    return { ...s, renewalStatus };
  });

  return res.status(200).json(results);
}
