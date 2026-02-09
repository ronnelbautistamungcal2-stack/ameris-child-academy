-- CreateEnum
CREATE TYPE "ChecklistPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "MilestoneItemKind" AS ENUM ('POLICY', 'PROCEDURE', 'VIDEO', 'LESSON', 'OTHER');

-- CreateTable
CREATE TABLE "MilestoneChecklistPlan" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "period" "ChecklistPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneChecklistPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneChecklistItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "kind" "MilestoneItemKind" NOT NULL DEFAULT 'OTHER',
    "url" TEXT,
    "policyDocumentId" TEXT,
    "lessonId" TEXT,
    "lessonGoalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneChecklistItemCompletion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneChecklistItemCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneChecklistPlan_centerId_period_periodStart_idx" ON "MilestoneChecklistPlan"("centerId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneChecklistPlan_centerId_period_periodStart_title_key" ON "MilestoneChecklistPlan"("centerId", "period", "periodStart", "title");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_planId_sortOrder_idx" ON "MilestoneChecklistItem"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_lessonId_idx" ON "MilestoneChecklistItem"("lessonId");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_lessonGoalId_idx" ON "MilestoneChecklistItem"("lessonGoalId");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_policyDocumentId_idx" ON "MilestoneChecklistItem"("policyDocumentId");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItemCompletion_childId_completedAt_idx" ON "MilestoneChecklistItemCompletion"("childId", "completedAt");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItemCompletion_itemId_completedAt_idx" ON "MilestoneChecklistItemCompletion"("itemId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneChecklistItemCompletion_childId_itemId_key" ON "MilestoneChecklistItemCompletion"("childId", "itemId");

-- AddForeignKey
ALTER TABLE "MilestoneChecklistPlan" ADD CONSTRAINT "MilestoneChecklistPlan_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItem" ADD CONSTRAINT "MilestoneChecklistItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MilestoneChecklistPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItem" ADD CONSTRAINT "MilestoneChecklistItem_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItem" ADD CONSTRAINT "MilestoneChecklistItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItem" ADD CONSTRAINT "MilestoneChecklistItem_lessonGoalId_fkey" FOREIGN KEY ("lessonGoalId") REFERENCES "LessonGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItemCompletion" ADD CONSTRAINT "MilestoneChecklistItemCompletion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MilestoneChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItemCompletion" ADD CONSTRAINT "MilestoneChecklistItemCompletion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItemCompletion" ADD CONSTRAINT "MilestoneChecklistItemCompletion_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
