ALTER TYPE "ChecklistFrequency" ADD VALUE IF NOT EXISTS 'ONE_TIME';

ALTER TABLE "DailyChecklistItem"
ADD COLUMN "frequency" "ChecklistFrequency" NOT NULL DEFAULT 'DAILY',
ADD COLUMN "repeatDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "monthlyDay" INTEGER,
ADD COLUMN "oneTimeDate" DATE;

UPDATE "DailyChecklistItem" AS item
SET
  "frequency" = checklist."frequency",
  "repeatDays" = checklist."repeatDays",
  "monthlyDay" = checklist."monthlyDay"
FROM "DailyChecklist" AS checklist
WHERE item."checklistId" = checklist."id";

CREATE INDEX "DailyChecklistItem_checklistId_frequency_idx"
ON "DailyChecklistItem"("checklistId", "frequency");

CREATE INDEX "DailyChecklistItem_oneTimeDate_idx"
ON "DailyChecklistItem"("oneTimeDate");
