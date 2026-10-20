import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { displayName } from "@/lib/ipp";
import { loadIppForUser } from "@/lib/ippAccess";

function fileType(name) {
  const ext = String(name || "").split(".").pop();
  return ext && ext !== name ? ext.toUpperCase().slice(0, 10) : null;
}

/**
 * POST   /api/v1/ipp/:id/documents  { name, url, notes? }   (file already uploaded)
 * PATCH  /api/v1/ipp/:id/documents  { documentId, notes }
 * DELETE /api/v1/ipp/:id/documents?documentId=
 * The plan's Documents & Notes tab. Managers only.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;
    const access = await loadIppForUser(user, req.query.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!access.canManage) return res.status(403).json({ error: "Only Student Support, coaches and admins can change plan documents" });
    const plan = access.plan;

    if (req.method === "POST") {
      const name = String(req.body?.name || "").trim().slice(0, 200);
      const url = String(req.body?.url || "").trim();
      if (!name || !url.startsWith("/uploads/")) return res.status(400).json({ error: "Upload a file first" });
      const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
      const doc = await prisma.behaviorPlanDocument.create({
        data: {
          planId: plan.id,
          name,
          url,
          fileType: fileType(name),
          notes: String(req.body?.notes || "").trim().slice(0, 500) || null,
          uploadedById: user.id,
          uploadedByName: displayName(me),
        },
      });
      return res.status(201).json({ id: doc.id });
    }

    const documentId = String(req.body?.documentId || req.query.documentId || "");
    const doc = await prisma.behaviorPlanDocument.findFirst({ where: { id: documentId, planId: plan.id } });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (req.method === "PATCH") {
      await prisma.behaviorPlanDocument.update({
        where: { id: doc.id },
        data: { notes: String(req.body?.notes || "").trim().slice(0, 500) || null },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await prisma.behaviorPlanDocument.delete({ where: { id: doc.id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["POST", "PATCH", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("ipp documents error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
