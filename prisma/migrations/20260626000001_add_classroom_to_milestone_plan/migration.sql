-- AlterTable
ALTER TABLE "MilestoneChecklistPlan" ADD COLUMN "classRoomId" TEXT;

-- CreateIndex
CREATE INDEX "MilestoneChecklistPlan_centerId_classRoomId_period_periodSta_idx" ON "MilestoneChecklistPlan"("centerId", "classRoomId", "period", "periodStart");

-- DropIndex
DROP INDEX "MilestoneChecklistPlan_centerId_period_periodStart_title_key";

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneChecklistPlan_centerId_period_periodStart_title_cla_key" ON "MilestoneChecklistPlan"("centerId", "period", "periodStart", "title", "classRoomId");

-- AddForeignKey
ALTER TABLE "MilestoneChecklistPlan" ADD CONSTRAINT "MilestoneChecklistPlan_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
