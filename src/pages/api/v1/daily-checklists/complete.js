import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH", "TEACHER", "OTHER_STAFF"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    const { itemId, date, notes, undo } = req.body || {};

    if (!itemId || !date) {
      return res.status(400).json({ error: "itemId and date are required" });
    }

    // Verify access to the checklist's center
    const item = await prisma.dailyChecklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: { select: { centerId: true, classRoomId: true, category: true } } },
    });

    if (!item) return res.status(404).json({ error: "Item not found" });

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, item.checklist.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }
    if (
      role === "OTHER_STAFF" &&
      (item.checklist.classRoomId || item.checklist.category === "CLASSROOM")
    ) {
      return res.status(403).json({ error: "Other staff cannot complete classroom checklists" });
    }

    const completionDate = new Date(date);

    if (undo) {
      // Remove completion
      await prisma.dailyChecklistCompletion.deleteMany({
        where: {
          itemId,
          completedById: session.user.id,
          date: completionDate,
        },
      });
      return res.status(200).json({ undone: true });
    }

    // Upsert completion
    const completion = await prisma.dailyChecklistCompletion.upsert({
      where: {
        itemId_completedById_date: {
          itemId,
          completedById: session.user.id,
          date: completionDate,
        },
      },
      update: { notes: notes || null, completedAt: new Date() },
      create: {
        itemId,
        completedById: session.user.id,
        date: completionDate,
        notes: notes || null,
      },
      include: {
        completedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(completion);
  }

  res.setHeader("Allow", ["POST"]);
  res.status(405).end();
}
