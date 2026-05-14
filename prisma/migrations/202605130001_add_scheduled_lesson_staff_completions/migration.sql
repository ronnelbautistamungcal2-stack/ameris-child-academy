-- CreateTable
CREATE TABLE "MilestoneChecklistStaffCompletion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneChecklistStaffCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneChecklistStaffCompletion_itemId_date_idx" ON "MilestoneChecklistStaffCompletion"("itemId", "date");

-- CreateIndex
CREATE INDEX "MilestoneChecklistStaffCompletion_completedById_date_idx" ON "MilestoneChecklistStaffCompletion"("completedById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneChecklistStaffCompletion_itemId_completedById_date_key" ON "MilestoneChecklistStaffCompletion"("itemId", "completedById", "date");

-- AddForeignKey
ALTER TABLE "MilestoneChecklistStaffCompletion" ADD CONSTRAINT "MilestoneChecklistStaffCompletion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MilestoneChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneChecklistStaffCompletion" ADD CONSTRAINT "MilestoneChecklistStaffCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
