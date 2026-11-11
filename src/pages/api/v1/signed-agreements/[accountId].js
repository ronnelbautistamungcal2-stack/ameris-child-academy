import fs from "fs";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizeRoles } from "@/lib/roles";
import { can } from "@/lib/globalPermissions";
import { signedFilePath } from "@/lib/subscriberEnrollment";

/**
 * GET /api/v1/signed-agreements/:accountId?file=agreement|certificate
 * The Subscriber Agreement a center signed in DocuSign (with its Order Form)
 * or DocuSign's completion certificate. For Ameris staff who can view
 * Subscribers, and for that account's own administrators. Kept outside
 * public/ so there's no open link.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, roles: true, disabled: true, subscriberAccountId: true, globalTeamRole: true, globalPermissions: true },
  });
  const accountId = String(req.query.accountId || "");
  const roles = normalizeRoles(me?.roles, me?.role);
  const allowed =
    me &&
    !me.disabled &&
    ((roles.includes("GLOBAL_ADMIN") && can(me, "SUBSCRIBERS", "VIEW")) || (roles.includes("ADMIN") && me.subscriberAccountId === accountId));
  if (!allowed) return res.status(403).json({ error: "You don't have access to this agreement" });

  const which = req.query.file === "certificate" ? "certificate" : "agreement";
  const account = await prisma.subscriberAccount.findUnique({ where: { id: accountId }, select: { id: true, accountNumber: true, signedAgreement: true } });
  const file = signedFilePath(account, which);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: "No signed agreement on file" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${account.accountNumber}-${which === "certificate" ? "signing-certificate" : "signed-agreement"}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  fs.createReadStream(file).pipe(res);
}
