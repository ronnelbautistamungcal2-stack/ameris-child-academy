import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ownsAccountDocument } from "@/lib/subscriberAccounts";

/**
 * GET /api/v1/forms/submissions/:id
 * One submitted form with its answers and e-signature (client 36-01, D5):
 * admins, and the person who sent it.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const submission = await prisma.formSubmission.findUnique({
    where: { id: String(req.query.id) },
    include: {
      template: { select: { id: true, title: true, description: true, subscriberAccountId: true } },
      child: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!submission) return res.status(404).json({ error: "Form not found" });
  const mine = submission.submittedById === session.user.id;
  if (!mine && session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!mine && !(await ownsAccountDocument(session.user.id, submission.template?.subscriberAccountId))) {
    return res.status(404).json({ error: "Form not found" });
  }
  return res.status(200).json(submission);
}
