ALTER TABLE "Lesson"
ADD COLUMN "termDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "lessonSlot" TEXT;

CREATE INDEX "Lesson_centerId_lessonSlot_idx"
ON "Lesson"("centerId", "lessonSlot");

CREATE TABLE "LessonTermCalendar" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTermCalendar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonTermCalendar_centerId_term_key"
ON "LessonTermCalendar"("centerId", "term");

CREATE INDEX "LessonTermCalendar_centerId_startDate_endDate_idx"
ON "LessonTermCalendar"("centerId", "startDate", "endDate");

ALTER TABLE "LessonTermCalendar"
ADD CONSTRAINT "LessonTermCalendar_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DailyChecklistItem"
ADD COLUMN "lessonSource" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "lessonSlot" TEXT;

UPDATE "DailyChecklistItem"
SET "lessonSource" = CASE
  WHEN "lessonId" IS NOT NULL THEN 'FIXED'
  ELSE 'NONE'
END
WHERE "lessonSource" = 'NONE';

CREATE INDEX "DailyChecklistItem_lessonSource_lessonSlot_idx"
ON "DailyChecklistItem"("lessonSource", "lessonSlot");
