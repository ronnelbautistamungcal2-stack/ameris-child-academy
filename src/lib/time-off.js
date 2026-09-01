export const TIME_OFF_TYPE_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

function normalizeRawType(value) {
  return String(value || "").trim().toUpperCase();
}

export function resolveTimeOffBalanceType(value) {
  const normalized = normalizeRawType(value);
  if (normalized === "UNPAID" || normalized === "UNEXCUSED") return "UNPAID";
  if (normalized === "PAID" || normalized === "PTO" || normalized === "SICK") {
    return "PAID";
  }
  return null;
}

export function normalizeTimeOffType(value) {
  return resolveTimeOffBalanceType(value) || "PAID";
}

export function isUnexcusedType(value) {
  return normalizeRawType(value) === "UNEXCUSED";
}

export function getTimeOffTypeLabel(value) {
  const normalized = normalizeRawType(value);
  if (normalized === "PAID" || normalized === "PTO") return "Paid";
  if (normalized === "UNPAID") return "Unpaid";
  if (normalized === "UNEXCUSED") return "Unexcused";
  if (normalized === "SICK") return "Sick";
  if (normalized === "OTHER") return "Other";
  if (!normalized) return "Paid";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

export function calculateTimeOffHours(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

export function roundHours(value) {
  const num = Number(value || 0);
  return Math.round(num * 100) / 100;
}

export function toUTCDateOnly(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isWeekendUTC(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Splits a start/end range that spans multiple calendar days into one
 * entry per weekday, reusing the original start/end time-of-day for every
 * day (matching the single start/end time inputs the request form collects).
 * When the start and end share the same time-of-day (e.g. both midnight,
 * meaning "whole days"), each entry spans the full 24-hour day instead of
 * collapsing to zero duration.
 *
 * Returns null when the range falls on a single calendar day (the caller
 * should keep treating it as one request in that case).
 */
export function splitTimeOffRangeIntoWorkdays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startDay = toUTCDateOnly(start);
  const endDay = toUTCDateOnly(end);
  if (!startDay || !endDay || startDay.getTime() === endDay.getTime()) return null;

  const startHours = start.getUTCHours();
  const startMinutes = start.getUTCMinutes();
  const endHours = end.getUTCHours();
  const endMinutes = end.getUTCMinutes();
  const sameTimeOfDay = startHours === endHours && startMinutes === endMinutes;

  const days = [];
  for (
    let day = new Date(startDay);
    day.getTime() <= endDay.getTime();
    day = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1))
  ) {
    if (isWeekendUTC(day)) continue;

    let dayStart;
    let dayEnd;
    if (sameTimeOfDay) {
      dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      dayEnd = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1),
      );
    } else {
      dayStart = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), startHours, startMinutes),
      );
      dayEnd = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), endHours, endMinutes),
      );
    }
    days.push({ startDate: dayStart, endDate: dayEnd });
  }

  return days;
}

/**
 * Groups a list of decorated time-off requests by requestGroupId (falling
 * back to the request's own id when it isn't part of a multi-day batch).
 * `fullGroupSizeByKey`, when provided, lets a filtered list (e.g. only
 * pending rows) still report how many days the original submission had in
 * total, even when some of those days now live in a different status bucket.
 */
export function groupTimeOffRequests(list, fullGroupSizeByKey) {
  const map = new Map();
  for (const request of list) {
    const key = request.requestGroupId || request.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(request);
  }
  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
      const fullGroupSize = fullGroupSizeByKey?.get(key) || sorted.length;
      return {
        key,
        items: sorted,
        isGrouped: sorted.length > 1 || fullGroupSize > 1,
        fullGroupSize,
        rangeStart: sorted[0].startDate,
        rangeEnd: sorted[sorted.length - 1].endDate,
      };
    })
    .sort((a, b) => new Date(a.rangeStart).getTime() - new Date(b.rangeStart).getTime());
}

export function decorateTimeOffRequest(request) {
  const hoursRequested = roundHours(
    calculateTimeOffHours(request?.startDate, request?.endDate),
  );
  return {
    ...request,
    type: normalizeTimeOffType(request?.type),
    typeLabel: getTimeOffTypeLabel(request?.type),
    balanceType: resolveTimeOffBalanceType(request?.type),
    isUnexcused: isUnexcusedType(request?.type),
    hoursRequested,
  };
}

export async function getTimeOffAvailabilityWarning(prisma, options = {}) {
  const { userId, centerId, type, startDate, endDate, excludeApprovedRequestId, precomputedHours } =
    options;
  const balanceType = resolveTimeOffBalanceType(type);
  const requestedHours =
    precomputedHours != null
      ? roundHours(precomputedHours)
      : roundHours(calculateTimeOffHours(startDate, endDate));

  if (!balanceType || !userId || !centerId) {
    return {
      balanceType,
      requestedHours,
      availableHours: 0,
      remainingHours: 0,
      overLimit: false,
    };
  }

  const summary = await getTimeOffBalanceSummary(prisma, {
    userId,
    centerId,
    excludeApprovedRequestId,
  });
  const availableHours =
    balanceType === "PAID"
      ? roundHours(summary.paidAvailable)
      : roundHours(summary.unpaidAvailable);
  const remainingHours = roundHours(availableHours - requestedHours);

  return {
    balanceType,
    requestedHours,
    availableHours,
    remainingHours,
    overLimit: requestedHours > availableHours,
    summary,
  };
}

export async function getTimeOffBalanceSummary(prisma, options = {}) {
  const { userId, centerId, excludeApprovedRequestId } = options;
  if (!userId || !centerId) {
    return {
      paidEarned: 0,
      unpaidEarned: 0,
      paidUsed: 0,
      unpaidUsed: 0,
      paidAvailable: 0,
      unpaidAvailable: 0,
    };
  }

  const [entries, approvedRequests] = await Promise.all([
    prisma.timeOffBalanceEntry.findMany({
      where: {
        userId,
        centerId,
      },
      select: {
        balanceType: true,
        hours: true,
        earnedDate: true,
        createdAt: true,
      },
      orderBy: [{ earnedDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.timeOffRequest.findMany({
      where: {
        userId,
        centerId,
        status: "APPROVED",
        ...(excludeApprovedRequestId
          ? {
              id: {
                not: excludeApprovedRequestId,
              },
            }
          : {}),
      },
      select: {
        type: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  // Paid hours accumulate across entries (roll over). Unpaid hours do not
  // roll over: each newly earned entry replaces the prior unpaid balance,
  // so only the most recently earned entry counts (entries are sorted
  // newest-earned first above).
  let paidEarned = 0;
  let unpaidEarned = 0;
  let unpaidEarnedSet = false;
  for (const entry of entries) {
    if (entry.balanceType === "PAID") {
      paidEarned += Number(entry.hours || 0);
    } else if (entry.balanceType === "UNPAID" && !unpaidEarnedSet) {
      unpaidEarned = Number(entry.hours || 0);
      unpaidEarnedSet = true;
    }
  }

  let paidUsed = 0;
  let unpaidUsed = 0;
  for (const request of approvedRequests) {
    const hours = calculateTimeOffHours(request.startDate, request.endDate);
    const bucket = resolveTimeOffBalanceType(request.type);
    if (bucket === "PAID") paidUsed += hours;
    if (bucket === "UNPAID") unpaidUsed += hours;
  }

  return {
    paidEarned: roundHours(paidEarned),
    unpaidEarned: roundHours(unpaidEarned),
    paidUsed: roundHours(paidUsed),
    unpaidUsed: roundHours(unpaidUsed),
    paidAvailable: roundHours(paidEarned - paidUsed),
    unpaidAvailable: roundHours(unpaidEarned - unpaidUsed),
  };
}
