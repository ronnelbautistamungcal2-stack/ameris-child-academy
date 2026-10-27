import { getSession } from "@/lib/auth";
import { milestoneParams, milestoneProgressReport } from "@/lib/milestoneReports";
import { reportCenter } from "@/lib/reportAccess";

/**
 * GET /api/v1/reports/milestone-progress?centerId=&date=&minMonths=&maxMonths=&categoryId=&subCategory=
 * [&enrolledOnly=1]  Milestone Progress Report (admins, and coaches and
 * Student Support at the center).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const access = await reportCenter(session.user, req.query.centerId, ["ADMIN", "COACH", "STUDENT_SUPPORT"]);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { center } = access;
  const centerId = center.id;
  const params = milestoneParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });
  return res.status(200).json({ center, ...params, ...(await milestoneProgressReport({ centerId, ...params, enrolledOnly: req.query.enrolledOnly === "1" })) });
}
