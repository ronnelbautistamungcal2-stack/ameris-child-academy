import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("affiliates/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.affiliate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Affiliate not found" });

  const { name, description, websiteUrl, contactEmail, contactPhone, logoUrl, partnershipType, isActive } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (contactPhone !== undefined) data.contactPhone = contactPhone;
  if (logoUrl !== undefined) data.logoUrl = logoUrl;
  if (partnershipType !== undefined) data.partnershipType = partnershipType;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.affiliate.update({ where: { id }, data });
  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.affiliate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Affiliate not found" });

  await prisma.affiliate.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
