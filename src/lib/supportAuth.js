import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * The signed-in subscriber admin, with their account id, or null after
 * replying 401/403. Customer Support is the admin's page (client 2026-11-07).
 */
export async function requireSubscriberAdmin(req, res) {
  const session = await getSession(req, res);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (session.user.role !== "ADMIN") {
    res.status(403).json({ error: "Only center admins can use Customer Support" });
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, subscriberAccountId: true },
  });
  if (!user?.subscriberAccountId) {
    res.status(403).json({ error: "Your login isn't linked to an Ameris Solutions subscription" });
    return null;
  }
  return user;
}
