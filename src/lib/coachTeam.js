// A coach only sees the staff on their own team (Staff Positions > Coaching
// Team) on every staff page (client request 2026-10-29). Server only.

/**
 * The user ids a coach may see on staff pages: their team plus themselves.
 * null means no limit: not signed in as a coach, or a coach with no team
 * assigned yet (they keep seeing the whole center rather than an empty page).
 */
export async function coachTeamUserIds(prisma, session) {
  if (String(session?.user?.role || "").toUpperCase() !== "COACH") return null;
  const rows = await prisma.coachTeamMember.findMany({ where: { coachId: session.user.id }, select: { staffId: true } });
  if (!rows.length) return null;
  return new Set([session.user.id, ...rows.map((r) => r.staffId)]);
}

/** Keeps the rows whose `key` (default id) is on the coach's team. */
export function onCoachTeam(rows, team, key = "id") {
  if (!team) return rows;
  return (rows || []).filter((row) => team.has(typeof key === "function" ? key(row) : row?.[key]));
}
