import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(todayKey + "T00:00:00.000Z");

  // Idempotency: skip if already ran today
  const existing = await prisma.notification.findFirst({
    where: {
      type: "FORM_RENEWAL",
      createdAt: { gte: todayStart },
      metadata: { path: ["alertDate"], equals: todayKey },
    },
  });
  if (existing) {
    return res.status(200).json({ message: "Renewal alerts already generated today", created: 0 });
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Find expiring submissions (within 30 days, not yet renewed)
  const expiringSubmissions = await prisma.formSubmission.findMany({
    where: {
      expiresAt: { lte: thirtyDaysFromNow, gte: now },
      renewedById: null,
    },
    include: {
      template: true,
      child: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Find already expired submissions (not yet renewed)
  const expiredSubmissions = await prisma.formSubmission.findMany({
    where: {
      expiresAt: { lt: now },
      renewedById: null,
    },
    include: {
      template: true,
      child: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Gather all notification recipients
  const notificationsToCreate = [];

  // Get all admin users for admin alerts
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  // Check notification preferences
  const allRecipientIds = [
    ...new Set([
      ...expiringSubmissions.map((s) => s.submittedBy.id),
      ...expiredSubmissions.map((s) => s.submittedBy.id),
      ...adminIds,
    ]),
  ];

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: allRecipientIds }, type: "FORM_RENEWAL" },
  });
  const disabledSet = new Set(prefs.filter((p) => !p.enabled).map((p) => p.userId));

  function addNotification(recipientId, title, body, link, metadata) {
    if (disabledSet.has(recipientId)) return;
    notificationsToCreate.push({ recipientId, type: "FORM_RENEWAL", title, body, link, metadata });
  }

  // Notify about expiring forms
  for (const sub of expiringSubmissions) {
    const childName = sub.child ? `${sub.child.firstName} ${sub.child.lastName || ""}`.trim() : "";
    const formTitle = sub.template?.title || "Form";
    const expiresDate = new Date(sub.expiresAt).toLocaleDateString();
    const body = childName
      ? `"${formTitle}" for ${childName} expires on ${expiresDate}`
      : `"${formTitle}" expires on ${expiresDate}`;
    const meta = { alertDate: todayKey, submissionId: sub.id, templateId: sub.templateId, childId: sub.childId, expiresAt: sub.expiresAt };

    addNotification(sub.submittedBy.id, "Form Expiring Soon", body, "/parent/forms", meta);
    for (const adminId of adminIds) {
      if (adminId !== sub.submittedBy.id) {
        addNotification(adminId, "Form Expiring Soon", body, "/admin/form-renewals", meta);
      }
    }
  }

  // Notify about expired forms
  for (const sub of expiredSubmissions) {
    const childName = sub.child ? `${sub.child.firstName} ${sub.child.lastName || ""}`.trim() : "";
    const formTitle = sub.template?.title || "Form";
    const body = childName
      ? `"${formTitle}" for ${childName} has expired`
      : `"${formTitle}" has expired`;
    const meta = { alertDate: todayKey, submissionId: sub.id, templateId: sub.templateId, childId: sub.childId, expiresAt: sub.expiresAt };

    addNotification(sub.submittedBy.id, "Form Expired", body, "/parent/forms", meta);
    for (const adminId of adminIds) {
      if (adminId !== sub.submittedBy.id) {
        addNotification(adminId, "Form Expired", body, "/admin/form-renewals", meta);
      }
    }
  }

  if (notificationsToCreate.length) {
    await prisma.notification.createMany({ data: notificationsToCreate });
    for (const n of notificationsToCreate) {
      emitNotification(n.recipientId, n);
    }
  }

  return res.status(200).json({
    message: "Renewal alerts generated",
    created: notificationsToCreate.length,
    summary: {
      expiringSoon: expiringSubmissions.length,
      expired: expiredSubmissions.length,
    },
  });
}
