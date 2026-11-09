/**
 * Centers made straight in the database have no subscriber account, so the
 * demo admin (whose account owns the demo centers) can't reach them. Put them
 * in that account by adding `subscriberAccountId: await demoAccountId(prisma)`
 * to the center's data.
 */
async function demoAccountId(prisma) {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@demo.com" },
    select: { subscriberAccountId: true },
  });
  return admin?.subscriberAccountId ?? null;
}

module.exports = { demoAccountId };
