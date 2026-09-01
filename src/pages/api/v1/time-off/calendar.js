import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";
import { decorateTimeOffRequest, getTimeOffTypeLabel } from "@/lib/time-off";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, from, to, includeEvents, includePending } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (session.user.role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
    }

    const timeOffWhere = {
      centerId,
    };

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      if (fromDate && toDate) {
        timeOffWhere.startDate = { lte: toDate };
        timeOffWhere.endDate = { gte: fromDate };
      } else if (fromDate) {
        timeOffWhere.endDate = { gte: fromDate };
      } else if (toDate) {
        timeOffWhere.startDate = { lte: toDate };
      }
    }

    const requestStatuses =
      String(includePending || "").trim() === "1"
        ? ["APPROVED", "PENDING"]
        : ["APPROVED"];

    const requests = await prisma.timeOffRequest.findMany({
      where: {
        ...timeOffWhere,
        status: { in: requestStatuses },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    });

    const decoratedRequests = requests.map(decorateTimeOffRequest);
    if (String(includeEvents || "").trim() !== "1") {
      return res.status(200).json(decoratedRequests);
    }

    const eventWhere = { centerId };
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      if (fromDate && toDate) {
        eventWhere.AND = [
          { startDate: { lte: toDate } },
          { endDate: { gte: fromDate } },
        ];
      } else if (fromDate) {
        eventWhere.endDate = { gte: fromDate };
      } else if (toDate) {
        eventWhere.startDate = { lte: toDate };
      }
    }

    const events = await prisma.event.findMany({
      where: eventWhere,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    });

    const eventRows = events.map((event) => ({
      id: `event-${event.id}`,
      _source: "event",
      type: event.type,
      status: "ACTIVE",
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay,
      label: event.title,
      description: event.description,
      createdBy: event.createdBy,
    }));

    const requestRows = decoratedRequests.map((request) => {
      const baseLabel = `${request.user?.name || "Unknown"} (${request.typeLabel || getTimeOffTypeLabel(request.type)})`;
      return {
        ...request,
        _source: "timeoff",
        label:
          request.isUnexcused && request.coverageName
            ? `${baseLabel} · Cover: ${request.coverageName}`
            : baseLabel,
      };
    });

    return res.status(200).json(
      [...eventRows, ...requestRows].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    );
  } catch (e) {
    console.error("time-off/calendar error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
