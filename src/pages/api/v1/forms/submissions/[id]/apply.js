import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_FIELDS = [
  "emergencyContact",
  "allergies",
  "healthAssessmentDocuments",
  "enrollmentDocuments",
  "feedingPlan",
];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can apply form data to child records" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { id } = req.query;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: { template: true, child: true },
  });

  if (!submission) return res.status(404).json({ error: "Submission not found" });
  if (!submission.childId) {
    return res.status(400).json({ error: "No child linked to this submission" });
  }
  if (submission.appliedToChild) {
    return res.status(400).json({ error: "Already applied to child record" });
  }

  const mapping = submission.template?.autoFillMapping;
  if (!mapping || typeof mapping !== "object") {
    return res.status(400).json({ error: "No auto-fill mapping configured for this form template" });
  }

  const formData = submission.data || {};
  const childUpdate = {};

  for (const [formKey, childField] of Object.entries(mapping)) {
    if (!ALLOWED_FIELDS.includes(childField)) continue;
    if (formData[formKey] !== undefined) {
      childUpdate[childField] = formData[formKey];
    }
  }

  if (Object.keys(childUpdate).length === 0) {
    return res.status(400).json({ error: "No applicable fields found in form data to update" });
  }

  await prisma.$transaction([
    prisma.child.update({
      where: { id: submission.childId },
      data: childUpdate,
    }),
    prisma.formSubmission.update({
      where: { id },
      data: {
        appliedToChild: true,
        appliedAt: new Date(),
        appliedById: session.user.id,
        status: "APPROVED",
      },
    }),
  ]);

  return res.status(200).json({
    success: true,
    fieldsUpdated: Object.keys(childUpdate),
  });
}
