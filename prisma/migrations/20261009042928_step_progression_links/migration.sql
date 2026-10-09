-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "ageMonths" INTEGER,
ADD COLUMN     "ageYears" INTEGER,
ADD COLUMN     "nextStepId" TEXT,
ADD COLUMN     "priorStepId" TEXT;

-- CreateIndex
CREATE INDEX "Lesson_priorStepId_idx" ON "Lesson"("priorStepId");

-- CreateIndex
CREATE INDEX "Lesson_nextStepId_idx" ON "Lesson"("nextStepId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_priorStepId_fkey" FOREIGN KEY ("priorStepId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
