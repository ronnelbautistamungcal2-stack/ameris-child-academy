import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { describeSubject, listAudit, loadTimeSheetAccess } from "@/lib/timeSheets";

// The time sheet audit report: every admin change or deletion, ongoing (no
// date range), with the original times and who changed what when.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { kind, subjectId } = req.query;
  const access = await loadTimeSheetAccess(prisma, session, kind, subjectId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  return res.status(200).json({
    subject: describeSubject(kind, access.subject),
    entries: await listAudit(prisma, kind, access.subject),
  });
}
