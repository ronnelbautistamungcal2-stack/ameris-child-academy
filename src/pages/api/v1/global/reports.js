import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { REPORTS, buildReport, parseRange } from "@/lib/globalReports";

/**
 * GET /api/v1/global/reports                       -> { reports: [{ key, label }] }
 * GET /api/v1/global/reports?report=&from=&to=     -> one report (stats, charts, columns, rows)
 * Global admin > Reports (client mockups 2026-11-06). Dates are YYYY-MM-DD;
 * the default range is this month.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "REPORTS", "VIEW");
  if (!session) return undefined;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  if (!req.query.report) return res.status(200).json({ reports: REPORTS });
  const report = await buildReport(String(req.query.report), parseRange(req.query));
  if (!report) return res.status(404).json({ error: "Report not found" });
  return res.status(200).json(report);
}
