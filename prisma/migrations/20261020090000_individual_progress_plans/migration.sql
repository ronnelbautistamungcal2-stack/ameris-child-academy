-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BehaviorPlanStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "BehaviorPlanStatus" ADD VALUE 'NEEDS_UPDATE';

-- AlterTable
ALTER TABLE "BehaviorPlan" ADD COLUMN     "focusArea" TEXT,
ADD COLUMN     "measurableOutcomes" TEXT,
ADD COLUMN     "planType" TEXT,
ADD COLUMN     "reviewSchedule" TEXT,
ADD COLUMN     "updatedByName" TEXT;

-- AlterTable
ALTER TABLE "BehaviorPlanGoal" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BehaviorPlanStrategy" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'STRATEGY',
    "text" TEXT NOT NULL,
    "role" TEXT,
    "frequency" TEXT,
    "notes" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorPlanStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorPlanDocument" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT,
    "notes" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorPlanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorPlanLog" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "goalId" TEXT,
    "date" DATE NOT NULL,
    "tactic" TEXT NOT NULL,
    "tacticDetail" TEXT,
    "observation" TEXT,
    "enteredById" TEXT,
    "enteredByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorPlanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviorPlanStrategy_goalId_sortOrder_idx" ON "BehaviorPlanStrategy"("goalId", "sortOrder");

-- CreateIndex
CREATE INDEX "BehaviorPlanDocument_planId_idx" ON "BehaviorPlanDocument"("planId");

-- CreateIndex
CREATE INDEX "BehaviorPlanLog_planId_date_idx" ON "BehaviorPlanLog"("planId", "date");

-- AddForeignKey
ALTER TABLE "BehaviorPlanStrategy" ADD CONSTRAINT "BehaviorPlanStrategy_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "BehaviorPlanGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlanDocument" ADD CONSTRAINT "BehaviorPlanDocument_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BehaviorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlanLog" ADD CONSTRAINT "BehaviorPlanLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BehaviorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlanLog" ADD CONSTRAINT "BehaviorPlanLog_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "BehaviorPlanGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

