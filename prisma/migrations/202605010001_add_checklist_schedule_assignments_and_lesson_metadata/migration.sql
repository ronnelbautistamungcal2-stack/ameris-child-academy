ALTER TABLE "Lesson"
ADD COLUMN "subCategory" TEXT,
ADD COLUMN "term" TEXT,
ADD COLUMN "reference" TEXT,
ADD COLUMN "linkedLessonId" TEXT;

ALTER TABLE "DailyChecklist"
ADD COLUMN "assignedUserId" TEXT,
ADD COLUMN "repeatDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "monthlyDay" INTEGER;

ALTER TABLE "DailyChecklistItem"
ADD COLUMN "lessonId" TEXT,
ADD COLUMN "policyDocumentId" TEXT,
ADD COLUMN "directLink" TEXT,
ADD COLUMN "directLinkLabel" TEXT;

ALTER TABLE "Lesson"
ADD CONSTRAINT "Lesson_linkedLessonId_fkey"
FOREIGN KEY ("linkedLessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyChecklist"
ADD CONSTRAINT "DailyChecklist_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyChecklistItem"
ADD CONSTRAINT "DailyChecklistItem_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyChecklistItem"
ADD CONSTRAINT "DailyChecklistItem_policyDocumentId_fkey"
FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lesson_linkedLessonId_idx" ON "Lesson"("linkedLessonId");
CREATE INDEX "Lesson_centerId_term_idx" ON "Lesson"("centerId", "term");
CREATE INDEX "DailyChecklist_assignedUserId_idx" ON "DailyChecklist"("assignedUserId");
CREATE INDEX "DailyChecklistItem_lessonId_idx" ON "DailyChecklistItem"("lessonId");
CREATE INDEX "DailyChecklistItem_policyDocumentId_idx" ON "DailyChecklistItem"("policyDocumentId");
