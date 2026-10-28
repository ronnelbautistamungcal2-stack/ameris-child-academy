import { getSession, hasAccessToCenter } from "@/lib/auth";
import { isLogActivityLink } from "@/lib/checklistLinks";
import prisma from "@/lib/prisma";

function todayDate() {
  const now = new Date();
  return new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
}

// Log Activity records that it was opened from a checklist item, which lets
// the staff member tick that item today (see checklistLinks.js).
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const itemId = String(req.body?.itemId || "");
  if (!itemId) return res.status(400).json({ error: "itemId is required" });
  const item = await prisma.dailyChecklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, directLink: true, checklist: { select: { centerId: true } } },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (!isLogActivityLink(item.directLink)) {
    return res.status(400).json({ error: "This item does not link to Log Activity" });
  }
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, item.checklist.centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const date = todayDate();
  const visit = await prisma.dailyChecklistLinkVisit.upsert({
    where: { itemId_userId_date: { itemId, userId: session.user.id, date } },
    update: {},
    create: { itemId, userId: session.user.id, date },
  });
  return res.status(200).json(visit);
}
