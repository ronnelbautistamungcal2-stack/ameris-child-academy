import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { guideAccountId, guideWhere } from "@/lib/characterGuideServer";
import { EMPLOYEE_ROLES, hasAnyRole } from "@/lib/roles";

/**
 * GET  /api/v1/character-guide/categories   staff (Daily Log, Character Guide)
 * POST /api/v1/character-guide/categories { name, description }   admins
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!hasAnyRole(session.user, EMPLOYEE_ROLES)) return res.status(403).json({ error: "Forbidden" });
  // Each subscriber account has its own guide (step D).
  const accountId = await guideAccountId(session.user);
  const mine = guideWhere(accountId);

  if (req.method === "GET") {
    const rows = await prisma.characterCategory.findMany({
      where: mine,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { behaviors: true } } },
    });
    return res.status(200).json(rows.map(({ _count, ...c }) => ({ ...c, behaviorCount: _count.behaviors })));
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    const name = String(req.body?.name || "").trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: "Category name is required" });
    if (await prisma.characterCategory.findFirst({ where: { ...mine, name: { equals: name, mode: "insensitive" } } })) {
      return res.status(409).json({ error: `There is already a category named ${name}` });
    }
    const last = await prisma.characterCategory.aggregate({ where: mine, _max: { sortOrder: true } });
    const created = await prisma.characterCategory.create({
      data: { subscriberAccountId: accountId || null, name, description: String(req.body?.description || "").trim().slice(0, 500) || null, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return res.status(201).json({ ...created, behaviorCount: 0 });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
