// Gives an existing user the Ameris Solutions Global Admin role (they keep
// their other roles and switch to it with the role switcher).
//   node scripts/grant-global-admin.js someone@example.com
//   node scripts/grant-global-admin.js someone@example.com --remove
const { PrismaClient } = require("@prisma/client");

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const remove = process.argv.includes("--remove");
  if (!email) {
    console.error("Usage: node scripts/grant-global-admin.js <email> [--remove]");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, roles: true } });
    if (!user) throw new Error(`No user with email ${email}`);
    const current = user.roles?.length ? user.roles : [user.role];
    const roles = remove ? current.filter((r) => r !== "GLOBAL_ADMIN") : [...new Set([...current, "GLOBAL_ADMIN"])];
    await prisma.user.update({ where: { id: user.id }, data: { roles: roles.length ? roles : ["PARENT"] } });
    console.log(`${email}: roles are now ${roles.join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
