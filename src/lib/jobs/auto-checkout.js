const prisma = require("../prisma");

// Automatic child checkout (client request 2026-10-02, Center setup > Care &
// Schedule): at a center's autoCheckoutTime, every child still signed in is
// signed out at that time, with "Admin" in the time sheet's By column. Staff
// are never signed out automatically; admins fix forgotten clock-outs.
//
// Runs every minute. It also closes earlier days that were missed (the server
// was down at checkout time). A child signed in after that day's checkout time
// is left for an admin, rather than being signed out the moment they arrive.

const AUTO_CHECKOUT_BY = "Admin";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseCheckoutTime(value) {
  const match = TIME_PATTERN.exec(String(value || ""));
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function runAutoCheckout({ now = new Date() } = {}) {
  const centers = await prisma.center.findMany({
    where: { autoCheckoutTime: { not: null } },
    select: { id: true, autoCheckoutTime: true },
  });

  let checkedOut = 0;
  for (const center of centers) {
    const time = parseCheckoutTime(center.autoCheckoutTime);
    if (!time) continue;

    const open = await prisma.attendance.findMany({
      where: {
        centerId: center.id,
        checkedInAt: { not: null },
        checkedOutAt: null,
        day: { lte: startOfDay(now) },
      },
      select: { id: true, day: true, checkedInAt: true },
    });

    for (const record of open) {
      const cutoff = new Date(record.day);
      cutoff.setHours(time.hours, time.minutes, 0, 0);
      if (cutoff > now || record.checkedInAt >= cutoff) continue;
      // updateMany so a child signed out by hand in the meantime is left alone.
      const result = await prisma.attendance.updateMany({
        where: { id: record.id, checkedOutAt: null },
        data: { checkedOutAt: cutoff, checkOutBy: AUTO_CHECKOUT_BY },
      });
      checkedOut += result.count;
    }
  }

  return { centers: centers.length, checkedOut };
}

module.exports = { runAutoCheckout, parseCheckoutTime, AUTO_CHECKOUT_BY };
