import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateRemediationProposals,
  commitRemediationProposals,
} from "@/lib/remediationGenerator";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can auto-generate remediations" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { centerId, dryRun, skipExisting } = req.body || {};
  if (!centerId) {
    return res.status(400).json({ error: "centerId is required" });
  }

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) return res.status(404).json({ error: "Center not found" });

  const isDryRun = dryRun !== false; // default to dry-run for safety

  try {
    const result = await generateRemediationProposals({
      prisma,
      centerId,
      skipExisting: skipExisting !== false,
    });

    if (isDryRun) {
      return res.status(200).json({ dryRun: true, ...result });
    }

    const commitResult = await commitRemediationProposals({
      prisma,
      proposals: result.proposals,
    });

    return res.status(200).json({
      dryRun: false,
      stats: result.stats,
      commitResult,
      skipped: result.skipped,
    });
  } catch (err) {
    console.error("Auto-generate remediations error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
