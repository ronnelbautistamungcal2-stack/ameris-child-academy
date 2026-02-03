import prisma from "@/lib/prisma";

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const code = normalizeCode(req.query.code);
  if (!code) return res.status(200).json({ valid: false });

  const invite = await prisma.centerInvite.findUnique({
    where: { code },
    include: { center: { select: { id: true, name: true } } },
  });

  const expired = invite?.expiresAt ? new Date(invite.expiresAt) < new Date() : false;
  const valid = !!invite && invite.active && !expired;

  if (!valid) return res.status(200).json({ valid: false });

  return res.status(200).json({
    valid: true,
    role: invite.role,
    centerId: invite.centerId,
    centerName: invite.center?.name || null,
  });
}

