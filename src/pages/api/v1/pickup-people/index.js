import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PICKUP_PERSON_INCLUDE, serializePickupPerson } from "@/lib/pickupPeople";

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
          OR: [
            { centers: { some: { centerId } } },
            { children: { some: { centerId } } },
            { guardianships: { some: { child: { centerId } } } },
          ],
          AND: terms.map((term) => ({
            OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }],
          })),
        },
        select: { id: true, name: true, email: true, middleInitial: true },
        orderBy: { name: "asc" },
        take: 20,
      })
    : [];
  const listed = new Set(people.map((p) => `${p.firstName} ${p.lastName}`.toLowerCase()));
  const userRows = users
    .map((u) => {
      const parts = String(u.name || "").trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || "";
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
      const fromName = parts.length > 2 && /^[A-Za-z]\.?$/.test(parts[1]) ? parts[1].replace(".", "") : "";
      return { id: `user:${u.id}`, source: "USER", firstName, lastName, middleInitial: u.middleInitial || fromName || "", phone: null, email: u.email };
    })
    .filter((u) => u.firstName && u.lastName && !listed.has(`${u.firstName} ${u.lastName}`.toLowerCase()));
  return res.status(200).json([...people.map(serializePickupPerson), ...userRows]);
}
