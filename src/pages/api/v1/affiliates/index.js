import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("affiliates error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const { centerId, isActive } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  const where = { centerId };
  if (isActive !== undefined) where.isActive = isActive === "true";

  const affiliates = await prisma.affiliate.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return res.status(200).json(affiliates);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId, name, description, websiteUrl, contactEmail, contactPhone, logoUrl, partnershipType, isActive } = req.body;

  if (!centerId || !name) {
    return res.status(400).json({ error: "centerId and name are required" });
  }

  const affiliate = await prisma.affiliate.create({
    data: {
      centerId,
      name,
      description: description || null,
      websiteUrl: websiteUrl || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      logoUrl: logoUrl || null,
      partnershipType: partnershipType || "General",
      isActive: isActive !== undefined ? isActive : true,
    },
  });

  return res.status(201).json(affiliate);
}
