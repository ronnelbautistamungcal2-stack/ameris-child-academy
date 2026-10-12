import { getSession } from "@/lib/auth";
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
  return res.status(200).json(people.map(serializePickupPerson));
}
