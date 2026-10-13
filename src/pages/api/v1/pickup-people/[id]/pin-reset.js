import { getSession } from "@/lib/auth";
import { issueRegistrationCode } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";

// Reset PIN for a pickup person: returns a temporary 6-digit registration code
// the admin takes to the kiosk, where the person chooses a new PIN. The code
// is shown once; only its hash is stored.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const person = await prisma.pickupPerson.findUnique({ where: { id: String(req.query.id) } });
  if (!person) return res.status(404).json({ error: "Person not found" });

  const { code, expiresAt } = await issueRegistrationCode(prisma, {
    pickupPersonId: person.id,
    issuedById: session.user.id,
  });
  return res.status(200).json({ code, expiresAt });
}
