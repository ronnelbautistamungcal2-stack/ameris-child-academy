import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { parseAccountInput, requireGlobalAdmin } from "@/lib/globalAdmin";
import { normalizeAgeGroups } from "@/lib/curriculumSource";
import { nextAccountNumber } from "@/lib/subscriberAccounts";

const LIST_SELECT = {
  id: true,
  accountNumber: true,
  name: true,
  status: true,
  addOns: true,
  maxCenters: true,
  maxChildren: true,
  createdAt: true,
  _count: { select: { centers: true } },
};

/**
 * GET  /api/v1/global/subscribers?status=&q= -> { subscribers, counts }
 * POST /api/v1/global/subscribers -> creates the account, its first center and
 *      its first admin { ...account fields, centerName, adminName, adminEmail, adminPassword }
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;

  if (req.method === "GET") {
    const status = String(req.query.status || "").toUpperCase();
    const q = String(req.query.q || "").trim();
    const where = {
      ...(status && status !== "ALL" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { accountNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [subscribers, grouped] = await Promise.all([
      prisma.subscriberAccount.findMany({ where, select: LIST_SELECT, orderBy: { accountNumber: "asc" } }),
      prisma.subscriberAccount.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts = { ALL: 0 };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
      counts.ALL += row._count._all;
    }
    const children = await prisma.child.groupBy({
      by: ["centerId"],
      where: { center: { subscriberAccountId: { in: subscribers.map((s) => s.id) } } },
      _count: { _all: true },
    });
    const centerAccounts = await prisma.center.findMany({
      where: { id: { in: children.map((c) => c.centerId) } },
      select: { id: true, subscriberAccountId: true },
    });
    const accountOf = new Map(centerAccounts.map((c) => [c.id, c.subscriberAccountId]));
    const childCount = new Map();
    for (const row of children) {
      const accountId = accountOf.get(row.centerId);
      childCount.set(accountId, (childCount.get(accountId) || 0) + row._count._all);
    }
    return res.status(200).json({
      counts,
      subscribers: subscribers.map(({ _count, ...s }) => ({
        ...s,
        centerCount: _count.centers,
        childCount: childCount.get(s.id) || 0,
      })),
    });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const parsed = parseAccountInput(body, { create: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (parsed.data.curriculumAgeGroups) parsed.data.curriculumAgeGroups = await normalizeAgeGroups(parsed.data.curriculumAgeGroups);

    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const adminName = String(body.adminName || "").trim();
    const adminPassword = String(body.adminPassword || "");
    const centerName = String(body.centerName || "").trim() || parsed.data.name;
    if (!adminName || !adminEmail) return res.status(400).json({ error: "The initial administrator's name and email are required" });
    if (!/^\S+@\S+\.\S+$/.test(adminEmail)) return res.status(400).json({ error: "Enter a valid administrator email" });
    if (adminPassword.length < 8) return res.status(400).json({ error: "The temporary password must be at least 8 characters" });
    if (await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } })) {
      return res.status(409).json({ error: "Someone already uses that administrator email" });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.subscriberAccount.create({
        data: {
          ...parsed.data,
          accountNumber: await nextAccountNumber(tx),
          contactName: parsed.data.contactName ?? adminName,
          contactEmail: parsed.data.contactEmail ?? adminEmail,
          status: parsed.data.status || "PENDING",
        },
      });
      const center = await tx.center.create({
        data: { name: centerName, subscriberAccountId: created.id },
      });
      await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: passwordHash,
          mustChangePassword: true,
          role: "ADMIN",
          roles: ["ADMIN"],
          subscriberAccountId: created.id,
          centers: { create: { centerId: center.id, role: "ADMIN" } },
        },
      });
      await tx.subscriberAccountNote.create({
        data: {
          accountId: created.id,
          authorId: session.user.id,
          description: `Account created with center "${centerName}" and administrator ${adminEmail}.`,
        },
      });
      return created;
    });
    return res.status(201).json(account);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
