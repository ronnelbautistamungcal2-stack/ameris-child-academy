-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CITIZENSHIP';
ALTER TYPE "ActivityType" ADD VALUE 'ACCOMPLISHMENT';

-- CreateTable
CREATE TABLE "ParentInvolvementActivity" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentInvolvementActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentInvolvement" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInvolvement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentInvolvementActivity_centerId_active_idx" ON "ParentInvolvementActivity"("centerId", "active");

-- CreateIndex
CREATE INDEX "ParentInvolvement_parentId_occurredAt_idx" ON "ParentInvolvement"("parentId", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentInvolvement_activityId_occurredAt_idx" ON "ParentInvolvement"("activityId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ParentInvolvementActivity" ADD CONSTRAINT "ParentInvolvementActivity_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvolvement" ADD CONSTRAINT "ParentInvolvement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ParentInvolvementActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvolvement" ADD CONSTRAINT "ParentInvolvement_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvolvement" ADD CONSTRAINT "ParentInvolvement_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "MilestoneChecklistPlan_centerId_classRoomId_period_periodSta_id" RENAME TO "MilestoneChecklistPlan_centerId_classRoomId_period_periodSt_idx";

-- RenameIndex
ALTER INDEX "MilestoneChecklistPlan_centerId_period_periodStart_title_cla_ke" RENAME TO "MilestoneChecklistPlan_centerId_period_periodStart_title_cl_key";
