import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";
import { emitNotification } from "@/lib/socket";

const VALID_STATUSES = ["PENDING", "APPROVED", "FULFILLED", "DENIED"];

const SUPPLY_REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true, email: true } },
  classRoom: { select: { id: true, name: true } },
  lesson: { select: { id: true, title: true } },
};

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Only staff can manage supply requests" });
    }

    const { id } = req.query;
    const request = await prisma.supplyRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    // Admins and the center's coaches review requests (status and a note).
    const isReviewer =
      session.user.role === "ADMIN" ||
      (session.user.role === "COACH" && (await hasAccessToCenter(session.user.id, request.centerId)));

    if (req.method === "PUT") {
      const isOwner = request.requestedById === session.user.id;
      if (!isReviewer && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { item, quantity, purpose, notes, status, reviewNote } = req.body || {};
      const data = {};

      // Only reviewers change the status or leave a note; owners editing their
      // own pending request can adjust its details before it's been reviewed.
      if (status !== undefined) {
        if (!isReviewer) {
          return res.status(403).json({ error: "Only admins and coaches can update the status" });
        }
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        data.status = status;
      }
      let noteChanged = false;
      if (reviewNote !== undefined) {
        if (!isReviewer) return res.status(403).json({ error: "Only admins and coaches can add a note" });
        const text = String(reviewNote || "").trim().slice(0, 1000) || null;
        noteChanged = text !== (request.reviewNote || null);
        data.reviewNote = text;
        data.reviewedById = session.user.id;
        data.reviewedAt = new Date();
      }
      if (item !== undefined && String(item).trim()) data.item = String(item).trim();
      if (quantity !== undefined) data.quantity = Number(quantity) > 0 ? Math.floor(Number(quantity)) : 1;
      if (purpose !== undefined) data.purpose = purpose || null;
      if (notes !== undefined) data.notes = notes || null;

      const updated = await prisma.supplyRequest.update({
        where: { id },
        data,
        include: SUPPLY_REQUEST_INCLUDE,
      });

      // Tell whoever asked for it what the note says.
      if (noteChanged && data.reviewNote && request.requestedById !== session.user.id) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: request.requestedById,
            type: "SYSTEM",
            title: `Note on your supply request: ${updated.item}`,
            body: `${session.user.name || "Your coach"}: ${data.reviewNote}`,
            link: "/dashboard",
            metadata: { supplyRequestId: id },
          },
        });
        emitNotification(request.requestedById, notification);
      }
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const isOwner = request.requestedById === session.user.id;
      if (!isReviewer && !(isOwner && request.status === "PENDING")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await prisma.supplyRequest.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("supply-requests/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
