import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { emitNotification } from "@/lib/socket";

const limiter = rateLimit({ interval: 60_000, limit: 5 });

const SUBJECT_LABELS = {
  enrollment: "Enrollment",
  programs: "Programs & Daily Routine",
  family_support: "Family Support",
  billing: "Billing",
  careers: "Careers",
  general: "General Question",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { isLimited, ip } = limiter.check(req);
  if (isLimited) {
    return res.status(429).json({
      error: "Too many contact attempts. Please wait a minute and try again.",
    });
  }

  const payload = normalizePayload(req.body || {});
  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const subjectLabel = SUBJECT_LABELS[payload.subject];
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "PUBLIC_CONTACT_REQUEST",
      ip,
      userAgent: userAgent || null,
      metadata: {
        ...payload,
        subjectLabel,
        submittedAt: new Date().toISOString(),
      },
    },
  });

  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (adminUsers.length > 0) {
    const notifications = await createAdminNotifications(
      adminUsers.map((user) => user.id),
      payload,
      subjectLabel,
    );

    for (const notification of notifications) {
      emitNotification(notification.recipientId, notification);
    }
  }

  return res.status(201).json({ success: true });
}

function normalizePayload(body) {
  return {
    fullName: clean(body.fullName, 120),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    childAgeRange: clean(body.childAgeRange, 80),
    startTimeline: clean(body.startTimeline, 120),
    subject: clean(body.subject, 40),
    message: clean(body.message, 2000),
  };
}

function validatePayload(payload) {
  if (payload.fullName.length < 2) return "Please enter your full name.";
  if (!isValidEmail(payload.email)) return "Please enter a valid email address.";
  if (!SUBJECT_LABELS[payload.subject]) return "Please select a topic.";
  if (payload.message.length < 20) return "Please include a little more detail in your message.";
  return "";
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createAdminNotifications(adminIds, payload, subjectLabel) {
  const preview = payload.message.length > 120
    ? `${payload.message.slice(0, 117)}...`
    : payload.message;

  const notificationData = adminIds.map((recipientId) => ({
    recipientId,
    type: "SYSTEM",
    title: `New website inquiry from ${payload.fullName}`,
    body: `${subjectLabel}: ${preview}`,
    link: "/admin/dashboard",
    metadata: {
      source: "public-contact-form",
      ...payload,
      subjectLabel,
    },
  }));

  if (typeof prisma.notification.createManyAndReturn === "function") {
    return prisma.notification.createManyAndReturn({ data: notificationData });
  }

  return Promise.all(
    notificationData.map((data) => prisma.notification.create({ data })),
  );
}
