const prisma = require("./prisma");

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function getClockedInTeacherIds({
  teacherIds,
  centerId = null,
  date = new Date(),
}) {
  const ids = Array.isArray(teacherIds)
    ? teacherIds.filter((value) => typeof value === "string" && value)
    : [];

  if (!ids.length) return new Set();

  const day = startOfDay(date);
  const rows = await prisma.staffAttendance.findMany({
    where: {
      userId: { in: ids },
      date: day,
      clockIn: { not: null },
      ...(centerId ? { centerId } : {}),
    },
    select: { userId: true },
  });

  return new Set(rows.map((row) => row.userId));
}

module.exports = {
  startOfDay,
  getClockedInTeacherIds,
};
