const prisma = require("../prisma");
const { emitNotification } = require("../socket");

async function runFormRenewalCheck({ initiatedBy = "scheduler" } = {}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);

  const existing = await prisma.notification.findFirst({
    where: {
      type: "FORM_RENEWAL",
      createdAt: { gte: todayStart },
      metadata: { path: ["alertDate"], equals: todayKey },
    },
  });

  if (existing) {
    return {
      skipped: true,
      created: 0,
      message: "Renewal alerts already generated today",
      summary: { expiringSoon: 0, expired: 0 },
    };
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [expiringSubmissions, expiredSubmissions, admins] = await Promise.all([
    prisma.formSubmission.findMany({
      where: {
        expiresAt: { lte: thirtyDaysFromNow, gte: now },
        renewedById: null,
      },
      include: {
        template: true,
        child: true,
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.formSubmission.findMany({
      where: {
        expiresAt: { lt: now },
        renewedById: null,
      },
      include: {
        template: true,
        child: true,
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    }),
  ]);

  const adminIds = admins.map((admin) => admin.id);
  const allRecipientIds = [
    ...new Set([
      ...expiringSubmissions.map((submission) => submission.submittedBy.id),
      ...expiredSubmissions.map((submission) => submission.submittedBy.id),
      ...adminIds,
    ]),
  ];

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: allRecipientIds }, type: "FORM_RENEWAL" },
  });
  const disabledSet = new Set(prefs.filter((pref) => !pref.enabled).map((pref) => pref.userId));

  const notificationsToCreate = [];
  const addNotification = (recipientId, title, body, link, metadata) => {
    if (disabledSet.has(recipientId)) return;
    notificationsToCreate.push({
      recipientId,
      type: "FORM_RENEWAL",
      title,
      body,
      link,
      metadata,
    });
  };

  for (const submission of expiringSubmissions) {
    const childName = submission.child
      ? `${submission.child.firstName} ${submission.child.lastName || ""}`.trim()
      : "";
    const formTitle = submission.template?.title || "Form";
    const expiresDate = new Date(submission.expiresAt).toLocaleDateString();
    const message = childName
      ? `"${formTitle}" for ${childName} expires on ${expiresDate}`
      : `"${formTitle}" expires on ${expiresDate}`;

    const metadata = {
      alertDate: todayKey,
      initiatedBy,
      submissionId: submission.id,
      templateId: submission.templateId,
      childId: submission.childId,
      expiresAt: submission.expiresAt,
    };

    addNotification(submission.submittedBy.id, "Form Expiring Soon", message, "/parent/forms", metadata);
    for (const adminId of adminIds) {
      if (adminId !== submission.submittedBy.id) {
        addNotification(adminId, "Form Expiring Soon", message, "/admin/form-renewals", metadata);
      }
    }
  }

  for (const submission of expiredSubmissions) {
    const childName = submission.child
      ? `${submission.child.firstName} ${submission.child.lastName || ""}`.trim()
      : "";
    const formTitle = submission.template?.title || "Form";
    const message = childName
      ? `"${formTitle}" for ${childName} has expired`
      : `"${formTitle}" has expired`;
    const metadata = {
      alertDate: todayKey,
      initiatedBy,
      submissionId: submission.id,
      templateId: submission.templateId,
      childId: submission.childId,
      expiresAt: submission.expiresAt,
    };

    addNotification(submission.submittedBy.id, "Form Expired", message, "/parent/forms", metadata);
    for (const adminId of adminIds) {
      if (adminId !== submission.submittedBy.id) {
        addNotification(adminId, "Form Expired", message, "/admin/form-renewals", metadata);
      }
    }
  }

  if (notificationsToCreate.length) {
    await prisma.notification.createMany({ data: notificationsToCreate });
    for (const notification of notificationsToCreate) {
      emitNotification(notification.recipientId, notification);
    }
  }

  return {
    skipped: false,
    created: notificationsToCreate.length,
    message: "Renewal alerts generated",
    summary: {
      expiringSoon: expiringSubmissions.length,
      expired: expiredSubmissions.length,
    },
  };
}

module.exports = {
  runFormRenewalCheck,
};
