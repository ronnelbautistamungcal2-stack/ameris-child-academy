import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PICKUP_PERSON_INCLUDE, pickupUserScope, serializePickupPerson, splitUserName } from "@/lib/pickupPeople";

// "Search for Existing Person" on the Authorized Pickup tab.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const centerId = String(req.query.centerId || "");
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  if (!(await hasAccessToCenter(session.user.id, centerId))) return res.status(403).json({ error: "Forbidden" });
  const terms = String(req.query.q || "").trim().split(/\s+/).filter(Boolean).slice(0, 4);

  const people = await prisma.pickupPerson.findMany({
    where: {
      centerId,
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { phone: { contains: term } },
        ],
      })),
    },
    include: PICKUP_PERSON_INCLUDE,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20,
  });
  // People already in the system (client sheet 2026-11-07): the center's staff
  // and the parents of its children. Picking one adds them as a pickup person.
  const users = terms.length
    ? await prisma.user.findMany({
        where: {
          ...pickupUserScope(centerId),
          AND: terms.map((term) => ({
            OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }],
          })),
        },
        select: { id: true, name: true, email: true, middleInitial: true },
        orderBy: { name: "asc" },
        take: 20,
      })
    : [];
  // A user already linked to one of the pickup people above shows only once.
  const linked = new Set(people.map((p) => p.userId).filter(Boolean));
  const userRows = users
    .filter((u) => !linked.has(u.id))
    .map((u) => ({ id: `user:${u.id}`, userId: u.id, source: "USER", ...splitUserName(u), phone: null, email: u.email }))
    .filter((u) => u.firstName && u.lastName);
  return res.status(200).json([...people.map(serializePickupPerson), ...userRows]);
}
