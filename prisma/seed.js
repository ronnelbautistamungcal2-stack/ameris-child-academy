const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@demo.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "adminpass";
  const teacherEmail = process.env.SEED_TEACHER_EMAIL || "teacher@demo.com";
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD || "teacherpass";
  const otherStaffEmail = process.env.SEED_OTHER_STAFF_EMAIL || "otherstaff@demo.com";
  const otherStaffPassword = process.env.SEED_OTHER_STAFF_PASSWORD || "otherstaffpass";
  const parentEmail = process.env.SEED_PARENT_EMAIL || "parent@demo.com";
  const parentPassword = process.env.SEED_PARENT_PASSWORD || "parentpass";
  const coachEmail = process.env.SEED_COACH_EMAIL || "coach@demo.com";
  const coachPassword = process.env.SEED_COACH_PASSWORD || "coachpass";

  if (process.env.NODE_ENV === "production") {
    const missingPasswords = [
      !process.env.SEED_ADMIN_PASSWORD && "SEED_ADMIN_PASSWORD",
      !process.env.SEED_TEACHER_PASSWORD && "SEED_TEACHER_PASSWORD",
      !process.env.SEED_OTHER_STAFF_PASSWORD && "SEED_OTHER_STAFF_PASSWORD",
      !process.env.SEED_PARENT_PASSWORD && "SEED_PARENT_PASSWORD",
      !process.env.SEED_COACH_PASSWORD && "SEED_COACH_PASSWORD",
    ].filter(Boolean);

    if (missingPasswords.length) {
      throw new Error(
        `Refusing to seed default passwords in production. Set ${missingPasswords.join(", ")}.`,
      );
    }
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const teacherHash = await bcrypt.hash(teacherPassword, 10);
  const otherStaffHash = await bcrypt.hash(otherStaffPassword, 10);
  const parentHash = await bcrypt.hash(parentPassword, 10);
  const coachHash = await bcrypt.hash(coachPassword, 10);

  let center = await prisma.center.findFirst({
    where: { name: "Demo Center" },
  });
  if (!center) {
    center = await prisma.center.create({
      data: { name: "Demo Center", address: "123 Demo St" },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin User",
      password: passwordHash,
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      name: "Admin User",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      name: "Teacher User",
      password: teacherHash,
      role: "TEACHER",
    },
    create: {
      email: teacherEmail,
      name: "Teacher User",
      password: teacherHash,
      role: "TEACHER",
    },
  });

  const parent = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {
      name: "Parent User",
      password: parentHash,
      role: "PARENT",
    },
    create: {
      email: parentEmail,
      name: "Parent User",
      password: parentHash,
      role: "PARENT",
    },
  });

  const otherStaff = await prisma.user.upsert({
    where: { email: otherStaffEmail },
    update: {
      name: "Other Staff User",
      password: otherStaffHash,
      role: "OTHER_STAFF",
    },
    create: {
      email: otherStaffEmail,
      name: "Other Staff User",
      password: otherStaffHash,
      role: "OTHER_STAFF",
    },
  });

  const coach = await prisma.user.upsert({
    where: { email: coachEmail },
    update: {
      name: "Coach User",
      password: coachHash,
      role: "COACH",
    },
    create: {
      email: coachEmail,
      name: "Coach User",
      password: coachHash,
      role: "COACH",
    },
  });

  for (const membership of [
    { userId: admin.id, centerId: center.id, role: "ADMIN" },
    { userId: teacher.id, centerId: center.id, role: "TEACHER" },
    { userId: otherStaff.id, centerId: center.id, role: "OTHER_STAFF" },
    { userId: coach.id, centerId: center.id, role: "COACH" },
  ]) {
    await prisma.centerUser.upsert({
      where: {
        userId_centerId: {
          userId: membership.userId,
          centerId: membership.centerId,
        },
      },
      update: { role: membership.role },
      create: membership,
    });
  }

  let classRoom = await prisma.classRoom.findFirst({
    where: { centerId: center.id, name: "Infant Room" },
  });
  if (!classRoom) {
    classRoom = await prisma.classRoom.create({
      data: { centerId: center.id, name: "Infant Room" },
    });
  }

  const existingAssignment = await prisma.teacherClass.findFirst({
    where: { teacherId: teacher.id, classId: classRoom.id },
  });
  if (!existingAssignment) {
    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classRoom.id },
    });
  }

  let child = await prisma.child.findFirst({
    where: { centerId: center.id, firstName: "Child", parentId: parent.id },
  });
  if (!child) {
    child = await prisma.child.create({
      data: {
        centerId: center.id,
        classRoomId: classRoom.id,
        firstName: "Child",
        lastName: "One",
        parentId: parent.id,
      },
    });
  }

  await prisma.subscription.upsert({
    where: { centerId: center.id },
    update: {
      tier: "PRO",
      active: true,
      expiresAt: null,
      paymentInfo: {
        features: {
          analytics: true,
          messaging: true,
          forms: true,
          exports: true,
          coachReports: true,
          teacherMetrics: true,
          pushNotifications: true,
          billingPortal: true,
          autoPay: false,
        },
        billing: {
          provider: "manual",
          customerId: "demo-center",
          supportEmail: "billing@demo.com",
          invoiceEmail: "billing@demo.com",
          paymentLinkUrl: "mailto:billing@demo.com?subject=Ameris%20Academy%20Payment",
          portalUrl: "mailto:billing@demo.com?subject=Ameris%20Academy%20Billing%20Portal",
          autopayEnabled: false,
          cardBrand: "Demo",
          cardLast4: "0001",
        },
      },
    },
    create: {
      centerId: center.id,
      tier: "PRO",
      active: true,
      expiresAt: null,
      paymentInfo: {
        features: {
          analytics: true,
          messaging: true,
          forms: true,
          exports: true,
          coachReports: true,
          teacherMetrics: true,
          pushNotifications: true,
          billingPortal: true,
          autoPay: false,
        },
        billing: {
          provider: "manual",
          customerId: "demo-center",
          supportEmail: "billing@demo.com",
          invoiceEmail: "billing@demo.com",
          paymentLinkUrl: "mailto:billing@demo.com?subject=Ameris%20Academy%20Payment",
          portalUrl: "mailto:billing@demo.com?subject=Ameris%20Academy%20Billing%20Portal",
          autopayEnabled: false,
          cardBrand: "Demo",
          cardLast4: "0001",
        },
      },
    },
  });

  // Volunteer opportunities for the parent involvement page
  const hasActivities = await prisma.parentInvolvementActivity.count({
    where: { centerId: center.id },
  });
  if (!hasActivities) {
    const at = (date, time) => new Date(`${date}T${time}:00`);
    const opportunities = [
      { title: "Classroom Helper", description: "Assist in classroom activities.", schedule: "Ongoing", capacity: 5 },
      { title: "Lunch Help", description: "Help serve lunch and tidy up afterwards.", schedule: "Ongoing", capacity: 3 },
      { title: "Playground Support", description: "Supervise and play during outdoor time.", schedule: "Ongoing", capacity: 4 },
      { title: "Special Event Helper", description: "Set up and run our seasonal events.", schedule: "Various Dates", capacity: 10 },
      { title: "Trunk or Treat", description: "Decorate a trunk and hand out treats.", startsAt: at("2026-10-24", "16:00"), endsAt: at("2026-10-24", "19:00"), capacity: 8 },
      { title: "Fall Clean-Up Day", description: "Help tidy the grounds and garden for fall.", startsAt: at("2026-10-10", "09:00"), endsAt: at("2026-10-10", "12:00"), capacity: 12 },
      { title: "Holiday Program", description: "Help with costumes, seating and snacks.", startsAt: at("2026-12-12", "13:00"), endsAt: at("2026-12-12", "16:00"), capacity: 8 },
      { title: "Donate Supplies", description: "Drop off classroom supplies from the wish list.", schedule: "Ongoing", capacity: null },
    ];
    await prisma.parentInvolvementActivity.createMany({
      data: opportunities.map((o, sortOrder) => ({ ...o, centerId: center.id, sortOrder })),
    });
  }

  // Demo invite codes (for signup flows)
  const invites = [
    { code: "PARENTDEMO", role: "PARENT" },
    { code: "TEACHERDEMO", role: "TEACHER" },
    { code: "OTHERSTAFFDEMO", role: "OTHER_STAFF" },
    { code: "COACHDEMO", role: "COACH" },
    { code: "SUBSCRIBERDEMO", role: "SUBSCRIBER" },
  ];

  for (const inv of invites) {
    const existingInvite = await prisma.centerInvite.findUnique({
      where: { code: inv.code },
    });
    if (!existingInvite) {
      await prisma.centerInvite.create({
        data: {
          code: inv.code,
          role: inv.role,
          centerId: center.id,
          active: true,
          createdById: admin.id,
        },
      });
    }
  }

  console.log("Seeded:", {
    centerId: center.id,
    adminEmail: admin.email,
    teacherEmail: teacher.email,
    otherStaffEmail: otherStaff.email,
    parentEmail: parent.email,
    coachEmail: coach.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
