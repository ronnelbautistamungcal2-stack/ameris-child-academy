import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parsePickupPersonInput, PICKUP_PERSON_INCLUDE, serializePickupPerson } from "@/lib/pickupPeople";

// Edit a pickup person's name or phone (rows of the Authorized Pickup List),
// or remove them entirely, which also removes their PIN.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!["PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  }

  const existing = await prisma.pickupPerson.findUnique({ where: { id: String(req.query.id) } });
  if (!existing) return res.status(404).json({ error: "Person not found" });

  if (req.method === "DELETE") {
    await prisma.pickupPerson.delete({ where: { id: existing.id } });
    return res.status(204).end();
  }

  const parsed = parsePickupPersonInput(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const person = await prisma.pickupPerson.update({
    where: { id: existing.id },
    data: parsed.data,
    include: PICKUP_PERSON_INCLUDE,
  });
  return res.status(200).json(serializePickupPerson(person));
}
