-- CreateTable
CREATE TABLE "DailyChecklistNote" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyChecklistNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyChecklistNote_checklistId_date_idx" ON "DailyChecklistNote"("checklistId", "date");

-- CreateIndex
CREATE INDEX "DailyChecklistNote_createdById_date_idx" ON "DailyChecklistNote"("createdById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChecklistNote_checklistId_createdById_date_key" ON "DailyChecklistNote"("checklistId", "createdById", "date");

-- AddForeignKey
ALTER TABLE "DailyChecklistNote" ADD CONSTRAINT "DailyChecklistNote_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "DailyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistNote" ADD CONSTRAINT "DailyChecklistNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
