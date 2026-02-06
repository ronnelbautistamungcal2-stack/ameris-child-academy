import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { importStepsLibrary } from "@/lib/stepsLibraryImporter.mjs";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { centerId, includeCondensedSheet } = req.body || {};
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  if (session.user.role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const summary = await importStepsLibrary({
      prisma,
      centerId,
      includeCondensedSheet: Boolean(includeCondensedSheet),
    });
    return res.status(200).json(summary);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Import failed" });
  }
}
