-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('OPENING', 'CLOSING', 'HEALTH_SAFETY', 'CLEANING', 'MEALS', 'CLASSROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "ChecklistFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "DailyChecklist" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "classRoomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ChecklistCategory" NOT NULL DEFAULT 'OTHER',
    "frequency" "ChecklistFrequency" NOT NULL DEFAULT 'DAILY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "policyLink" TEXT,
    "mediaLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChecklistCompletion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChecklistCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyChecklist_centerId_category_idx" ON "DailyChecklist"("centerId", "category");

-- CreateIndex
CREATE INDEX "DailyChecklist_centerId_classRoomId_idx" ON "DailyChecklist"("centerId", "classRoomId");

-- CreateIndex
CREATE INDEX "DailyChecklistItem_checklistId_sortOrder_idx" ON "DailyChecklistItem"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyChecklistCompletion_itemId_date_idx" ON "DailyChecklistCompletion"("itemId", "date");

-- CreateIndex
CREATE INDEX "DailyChecklistCompletion_completedById_date_idx" ON "DailyChecklistCompletion"("completedById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChecklistCompletion_itemId_completedById_date_key" ON "DailyChecklistCompletion"("itemId", "completedById", "date");

-- AddForeignKey
ALTER TABLE "DailyChecklist" ADD CONSTRAINT "DailyChecklist_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklist" ADD CONSTRAINT "DailyChecklist_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistItem" ADD CONSTRAINT "DailyChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "DailyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistCompletion" ADD CONSTRAINT "DailyChecklistCompletion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DailyChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistCompletion" ADD CONSTRAINT "DailyChecklistCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
