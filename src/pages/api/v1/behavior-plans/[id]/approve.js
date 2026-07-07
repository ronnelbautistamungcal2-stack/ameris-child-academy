import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import { emitNotification } from "@/lib/socket";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Plan id is required" });

    const plan = await prisma.behaviorPlan.findUnique({
      where: { id },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentId: true,
            centerId: true,
            classRoomId: true,
            guardians: { select: { guardianId: true } },
          },
        },
      },
    });

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Only the linked parent can approve
    if (session.user.role === "PARENT") {
      if (!isChildLinkedToParent(plan.child, session.user.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (!["ADMIN"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { signatureName } = req.body || {};

    const updated = await prisma.behaviorPlan.update({
      where: { id },
      data: {
        parentApproved: true,
        parentApprovedAt: new Date(),
        parentSignatureName: signatureName || session.user.name || "Parent",
      },
      include: {
        child: { select: { firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
      },
    });

    // Create a red flag (ChildFlagReview) so teachers can see this plan was approved
    const childName = `${plan.child?.firstName || ""} ${plan.child?.lastName || ""}`.trim();
    const flagKey = `behavior-plan-approved-${id}`;

    await prisma.childFlagReview.upsert({
      where: { flagKey },
      create: {
        centerId: plan.child.centerId,
        childId: plan.child.id,
        flagKey,
        snapshot: {
          type: "INDIVIDUAL_PROGRESS_PLAN",
          planId: id,
          planTitle: plan.title,
          childName,
          approvedAt: new Date().toISOString(),
          approvedBy: signatureName || session.user.name || "Parent",
        },
      },
      update: {
        snapshot: {
          type: "INDIVIDUAL_PROGRESS_PLAN",
          planId: id,
          planTitle: plan.title,
          childName,
          approvedAt: new Date().toISOString(),
          approvedBy: signatureName || session.user.name || "Parent",
        },
        closedAt: null,
      },
    }).catch(() => {});

    // Notify admins that parent has approved
    const admins = await prisma.centerUser.findMany({
      where: {
        centerId: plan.centerId,
        user: { role: "ADMIN" },
      },
      select: { userId: true },
    }).catch(() => []);

    if (admins.length > 0) {
      const adminNotifications = admins.map(({ userId }) => ({
        recipientId: userId,
        type: "ACTIVITY_UPDATE",
        title: "Individual Progress Plan Approved by Parent",
        body: `${childName}'s Individual Progress Plan "${plan.title}" has been approved by the parent.`,
        metadata: { planId: id, childId: plan.child.id },
      }));
      await prisma.notification.createMany({ data: adminNotifications, skipDuplicates: true }).catch(() => {});
      adminNotifications.forEach((n) => emitNotification(n.recipientId, n));
    }

    // Notify the assigned teacher(s) when an admin approves on the parent's behalf
    if (session.user.role === "ADMIN" && plan.child.classRoomId) {
      const teacherAssignments = await prisma.teacherClass.findMany({
        where: { classId: plan.child.classRoomId },
        select: { teacherId: true },
      }).catch(() => []);

      if (teacherAssignments.length > 0) {
        const teacherNotifications = teacherAssignments.map(({ teacherId }) => ({
          recipientId: teacherId,
          type: "ACTIVITY_UPDATE",
          title: "Individual Progress Plan Approved",
          body: `${childName}'s Individual Progress Plan "${plan.title}" has been approved by an admin.`,
          metadata: { planId: id, childId: plan.child.id },
        }));
        await prisma.notification.createMany({ data: teacherNotifications, skipDuplicates: true }).catch(() => {});
        teacherNotifications.forEach((n) => emitNotification(n.recipientId, n));
      }
    }

    return res.status(200).json(updated);
  } catch (e) {
    console.error("behavior-plans/[id]/approve error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
