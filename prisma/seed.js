const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("adminpass", 10);

  let center = await prisma.center.findFirst({
    where: { name: "Demo Center" },
  });
  if (!center) {
    center = await prisma.center.create({
      data: { name: "Demo Center", address: "123 Demo St" },
    });
  }

  let admin = await prisma.user.findUnique({
    where: { email: "admin@demo.com" },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "admin@demo.com",
        name: "Admin User",
        password: passwordHash,
        role: "ADMIN",
        centers: {
          create: { center: { connect: { id: center.id } }, role: "ADMIN" },
        },
      },
    });
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
