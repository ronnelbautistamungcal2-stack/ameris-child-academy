import path from "path";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { importStepsLibrary } from "@/lib/stepsLibraryImporter.mjs";

function asBool(value) {
  if (value === true) return true;
  if (value === false) return false;
  const s = String(value || "").trim().toLowerCase();
  if (!s) return false;
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN")
    return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const {
    centerId,
    includeCondensedSheet,
    categorySource = "subject",
    categoryKind = "PACKAGE",
    forceKindUpdate = false,
  } = req.body || {};

  const workbookPath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "StepsofProgressionLibrary.xlsx",
  );

  const centers = centerId
    ? await prisma.center.findMany({ where: { id: centerId } })
    : await prisma.center.findMany({ orderBy: { createdAt: "asc" } });

  if (!centers.length) return res.status(404).json({ error: "Center not found" });

  const results = [];
  const totals = {
    centers: centers.length,
    sheets: 0,
    rowsSeen: 0,
    rowsImported: 0,
    categoriesCreated: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    goalsCreated: 0,
    goalsSkippedExisting: 0,
    rowsSkippedNoStep: 0,
  };

  for (const c of centers) {
    const summary = await importStepsLibrary({
      prisma,
      centerId: c.id,
      workbookPath,
      includeCondensedSheet: asBool(includeCondensedSheet),
      categorySource,
      categoryKind,
      forceKindUpdate: asBool(forceKindUpdate),
    });
    results.push({ centerId: c.id, centerName: c.name, summary });

    for (const key of Object.keys(totals)) {
      if (key === "centers") continue;
      totals[key] += Number(summary?.[key] || 0);
    }
  }

  return res.status(200).json({ workbookPath, totals, results });
}

