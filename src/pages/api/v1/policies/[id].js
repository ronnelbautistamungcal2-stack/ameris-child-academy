import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("policies/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const { id } = req.query;
  const doc = await prisma.policyDocument.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: "Policy not found" });
  return res.status(200).json(doc);
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage policies" });
  }

  const { id } = req.query;
  const existing = await prisma.policyDocument.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });

  const { title, description, url, roles, centerId } = req.body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (url !== undefined) data.url = url;
  if (roles !== undefined) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: "roles must be a non-empty array" });
    }
    data.roles = roles;
  }
  if (centerId !== undefined) data.centerId = centerId || null;

  const updated = await prisma.policyDocument.update({ where: { id }, data });
  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage policies" });
  }

  const { id } = req.query;
  const existing = await prisma.policyDocument.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });

  await prisma.policyDocument.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
