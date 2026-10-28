import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
      template: { select: { id: true, title: true, description: true } },
      child: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!submission) return res.status(404).json({ error: "Form not found" });
  if (session.user.role !== "ADMIN" && submission.submittedById !== session.user.id) return res.status(403).json({ error: "Forbidden" });
  return res.status(200).json(submission);
}
