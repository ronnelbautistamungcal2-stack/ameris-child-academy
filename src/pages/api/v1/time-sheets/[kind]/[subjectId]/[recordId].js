import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteRow, editorInitials, loadTimeSheetAccess, TimeSheetError, updateRow } from "@/lib/timeSheets";

// Edit (PUT { timeIn?, timeOut? }) or delete one time sheet row. Both are
// written to the audit report with the original times.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { kind, subjectId, recordId } = req.query;
  const access = await loadTimeSheetAccess(prisma, session, kind, subjectId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  try {
    const editor = await editorInitials(prisma, session.user.id);
    if (req.method === "PUT") {
      const body = req.body || {};
      await updateRow(prisma, kind, access, recordId, {
        timeIn: "timeIn" in body ? body.timeIn : undefined,
        timeOut: "timeOut" in body ? body.timeOut : undefined,
        editor,
        editorUserId: session.user.id,
      });
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      await deleteRow(prisma, kind, access, recordId, { editor, editorUserId: session.user.id });
      return res.status(204).end();
    }
  } catch (error) {
    if (error instanceof TimeSheetError) return res.status(error.status).json({ error: error.message });
    throw error;
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
