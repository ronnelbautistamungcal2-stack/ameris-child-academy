import { getSession } from "@/lib/auth";
import { issueRegistrationCode } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";
import { hasEmployeeRole } from "@/lib/roles";

// Reset PIN for a user: returns a temporary 6-digit registration code the
// admin takes to the kiosk, where the person chooses a new PIN. The code is
// shown once; only its hash is stored. HR may reset staff PINs (Staff List).
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const user = await prisma.user.findUnique({
    where: { id: String(req.query.id) },
    select: { id: true, role: true, roles: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const role = session.user.role;
  const isStaffMember = hasEmployeeRole(user.roles?.length ? user.roles : [user.role]);
  if (!(role === "ADMIN" || (role === "HR_STAFF" && isStaffMember))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { code, expiresAt } = await issueRegistrationCode(prisma, {
    userId: user.id,
    issuedById: session.user.id,
  });
  return res.status(200).json({ code, expiresAt });
}
