export const TIME_OFF_TYPE_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

function normalizeRawType(value) {
  return String(value || "").trim().toUpperCase();
}

export function resolveTimeOffBalanceType(value) {
  const normalized = normalizeRawType(value);
  if (normalized === "UNPAID") return "UNPAID";
  if (normalized === "PAID" || normalized === "PTO" || normalized === "SICK") {
    return "PAID";
  }
  return null;
}

export function normalizeTimeOffType(value) {
  return resolveTimeOffBalanceType(value) || "PAID";
}

export function getTimeOffTypeLabel(value) {
  const normalized = normalizeRawType(value);
  if (normalized === "PAID" || normalized === "PTO") return "Paid";
  if (normalized === "UNPAID") return "Unpaid";
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

export function decorateTimeOffRequest(request) {
  const hoursRequested = roundHours(
    calculateTimeOffHours(request?.startDate, request?.endDate),
  );
  return {
    ...request,
    type: normalizeTimeOffType(request?.type),
    typeLabel: getTimeOffTypeLabel(request?.type),
    balanceType: resolveTimeOffBalanceType(request?.type),
    hoursRequested,
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
      },
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

  let paidEarned = 0;
  let unpaidEarned = 0;
  for (const entry of entries) {
    if (entry.balanceType === "PAID") paidEarned += Number(entry.hours || 0);
    if (entry.balanceType === "UNPAID") unpaidEarned += Number(entry.hours || 0);
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
