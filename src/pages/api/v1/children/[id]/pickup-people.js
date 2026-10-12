import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  loadChildPickupAccess,
  parsePickupPersonInput,
  PICKUP_PERSON_INCLUDE,
  serializePickupPerson,
} from "@/lib/pickupPeople";

// A child's authorized pickup list (Edit Child > Authorized Pickup tab).
async function listForChild(childId) {
  const links = await prisma.childPickupPerson.findMany({
    where: { childId },
    include: { pickupPerson: { include: PICKUP_PERSON_INCLUDE } },
    orderBy: { createdAt: "asc" },
  });
  return links.map((link) => serializePickupPerson(link.pickupPerson));
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const access = await loadChildPickupAccess(prisma, session, req.query.id);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { child } = access;

  if (req.method === "GET") {
    return res.status(200).json(await listForChild(child.id));
  }

  if (!access.canManage) return res.status(403).json({ error: "Only admins can change authorized pickups" });

  if (req.method === "POST") {
    const { pickupPersonId, copyFromChildId } = req.body || {};

    if (copyFromChildId) {
      // "Copy from another child", e.g. siblings with the same pickup people.
      const source = await prisma.child.findUnique({ where: { id: String(copyFromChildId) } });
      if (!source || source.centerId !== child.centerId) {
        return res.status(400).json({ error: "Choose a child from the same center" });
      }
      const links = await prisma.childPickupPerson.findMany({ where: { childId: source.id } });
      await prisma.childPickupPerson.createMany({
        data: links.map((link) => ({ childId: child.id, pickupPersonId: link.pickupPersonId })),
        skipDuplicates: true,
      });
      return res.status(200).json(await listForChild(child.id));
    }

    if (pickupPersonId) {
      // "Select Existing Person"
      const person = await prisma.pickupPerson.findUnique({ where: { id: String(pickupPersonId) } });
      if (!person || person.centerId !== child.centerId) {
        return res.status(400).json({ error: "Choose a person from the same center" });
      }
      await prisma.childPickupPerson.upsert({
        where: { childId_pickupPersonId: { childId: child.id, pickupPersonId: person.id } },
        update: {},
        create: { childId: child.id, pickupPersonId: person.id },
      });
      return res.status(200).json(await listForChild(child.id));
    }

    // "Add New Person"
    const parsed = parsePickupPersonInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    await prisma.pickupPerson.create({
      data: {
        ...parsed.data,
        centerId: child.centerId,
        children: { create: { childId: child.id } },
      },
    });
    return res.status(201).json(await listForChild(child.id));
  }

  if (req.method === "DELETE") {
    const pickupPersonId = String(req.query.pickupPersonId || "");
    if (!pickupPersonId) return res.status(400).json({ error: "pickupPersonId is required" });
    // Takes the person off this child's list only; they keep their PIN for any
    // other children they pick up.
    await prisma.childPickupPerson.deleteMany({ where: { childId: child.id, pickupPersonId } });
    return res.status(200).json(await listForChild(child.id));
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).end();
}
