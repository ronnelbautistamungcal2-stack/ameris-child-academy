const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@demo.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "adminpass";
  if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error("Refusing to seed default admin password in production. Set SEED_ADMIN_PASSWORD.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  let center = await prisma.center.findFirst({
    where: { name: "Demo Center" },
  });
  if (!center) {
    center = await prisma.center.create({
      data: { name: "Demo Center", address: "123 Demo St" },
    });
  }

  let admin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin User",
        password: passwordHash,
        role: "ADMIN",
        centers: {
          create: { center: { connect: { id: center.id } }, role: "ADMIN" },
        },
      },
    });
  }

  // Demo teacher + parent + child
  const teacherEmail = process.env.SEED_TEACHER_EMAIL || "teacher@demo.com";
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD || "teacherpass";
  const parentEmail = process.env.SEED_PARENT_EMAIL || "parent@demo.com";
  const parentPassword = process.env.SEED_PARENT_PASSWORD || "parentpass";

  const teacherHash = await bcrypt.hash(teacherPassword, 10);
  const parentHash = await bcrypt.hash(parentPassword, 10);

  let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: {
        email: teacherEmail,
        name: "Teacher User",
        password: teacherHash,
        role: "TEACHER",
        centers: {
          create: { center: { connect: { id: center.id } }, role: "TEACHER" },
        },
      },
    });
  }

  let parent = await prisma.user.findUnique({ where: { email: parentEmail } });
  if (!parent) {
    parent = await prisma.user.create({
      data: {
        email: parentEmail,
        name: "Parent User",
        password: parentHash,
        role: "PARENT",
      },
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

  // Demo invite codes (for signup flows)
  const invites = [
    { code: "PARENTDEMO", role: "PARENT" },
    { code: "TEACHERDEMO", role: "TEACHER" },
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

  console.log("Seeded:", { centerId: center.id, adminEmail: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
