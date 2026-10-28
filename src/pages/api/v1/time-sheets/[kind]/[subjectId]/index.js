import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createRow,
  describeSubject,
  editorInitials,
  listRows,
  loadTimeSheetAccess,
  TimeSheetError,
} from "@/lib/timeSheets";

// A child's or employee's time sheet. GET lists rows (?from=&to= for the
// report's date range); POST adds a missing day. kind is "child" or "staff".
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { kind, subjectId } = req.query;
  const access = await loadTimeSheetAccess(prisma, session, kind, subjectId, { allowSelfRead: req.method === "GET" });
  if (access.error) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") {
    const rows = await listRows(prisma, kind, access.subject, { from: req.query.from, to: req.query.to });
    return res.status(200).json({ subject: describeSubject(kind, access.subject), rows });
  }

  if (req.method === "POST") {
    try {
      const editor = await editorInitials(prisma, session.user.id);
      const row = await createRow(prisma, kind, access, {
        timeIn: req.body?.timeIn,
        timeOut: req.body?.timeOut,
        editor,
      });
      return res.status(201).json({ id: row.id });
    } catch (error) {
      if (error instanceof TimeSheetError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
