ALTER TABLE "DailyChecklist"
ADD COLUMN "monthlyWeek" INTEGER,
ADD COLUMN "monthlyWeekday" INTEGER;

ALTER TABLE "DailyChecklistItem"
ADD COLUMN "monthlyWeek" INTEGER,
ADD COLUMN "monthlyWeekday" INTEGER;
