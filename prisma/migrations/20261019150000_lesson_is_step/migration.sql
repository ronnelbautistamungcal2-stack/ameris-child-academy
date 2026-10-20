-- Steps of Progression Bank rows are flagged; every existing row stays a
-- Lesson Bank lesson, which empties the Steps bank.
ALTER TABLE "Lesson" ADD COLUMN "isStep" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lesson_centerId_isStep_idx" ON "Lesson"("centerId", "isStep");
