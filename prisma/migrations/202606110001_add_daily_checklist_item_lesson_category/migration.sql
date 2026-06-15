ALTER TABLE "DailyChecklistItem"
ADD COLUMN "lessonCategoryId" TEXT;

ALTER TABLE "DailyChecklistItem"
ADD CONSTRAINT "DailyChecklistItem_lessonCategoryId_fkey"
FOREIGN KEY ("lessonCategoryId") REFERENCES "LessonCategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DailyChecklistItem_lessonCategoryId_idx"
ON "DailyChecklistItem"("lessonCategoryId");
