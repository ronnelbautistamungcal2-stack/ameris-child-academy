import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";

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

    if (req.method === "PUT") {
      const isOwner = request.requestedById === session.user.id;
      if (session.user.role !== "ADMIN" && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { item, quantity, purpose, notes, status } = req.body || {};
      const data = {};

      // Only admins can change status; owners editing their own pending request
      // can adjust its details before it's been reviewed.
      if (status !== undefined) {
        if (session.user.role !== "ADMIN") {
          return res.status(403).json({ error: "Only admins can update the status" });
        }
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        data.status = status;
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
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const isOwner = request.requestedById === session.user.id;
      if (session.user.role !== "ADMIN" && !(isOwner && request.status === "PENDING")) {
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
