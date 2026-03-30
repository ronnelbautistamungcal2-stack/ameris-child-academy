import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { badRequest, createApiHandler, forbidden, notFound, unauthorized } from "@/lib/api-error";
import { optionalString } from "@/lib/validation";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const id = optionalString(req.query, "id");
  if (!id) throw badRequest("id is required", { field: "id" });
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw notFound("Not found");
  if (notification.recipientId !== session.user.id) throw forbidden();

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return res.status(200).json(updated);
}, { methods: ["PATCH"], logLabel: "notifications/[id] error:" });
