-- Classroom budgets get a period (week / month / quarter / year) with start
-- and end dates and auto-renew, instead of one row per "YYYY-MM" month.

-- DropIndex
DROP INDEX "ClassroomBudget_centerId_month_idx";

-- DropIndex
DROP INDEX "ClassroomBudget_classRoomId_month_key";

-- AlterTable
ALTER TABLE "ClassroomBudget" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "period" TEXT NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "startDate" DATE,
ALTER COLUMN "month" DROP NOT NULL;

-- Existing budgets were monthly: the month's first and last day.
UPDATE "ClassroomBudget"
SET "startDate" = to_date("month" || '-01', 'YYYY-MM-DD'),
    "endDate" = (to_date("month" || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' - INTERVAL '1 day')::date
WHERE "month" ~ '^\d{4}-\d{2}$';

UPDATE "ClassroomBudget"
SET "startDate" = date_trunc('month', "createdAt")::date,
    "endDate" = (date_trunc('month', "createdAt") + INTERVAL '1 month' - INTERVAL '1 day')::date
WHERE "startDate" IS NULL;

ALTER TABLE "ClassroomBudget" ALTER COLUMN "startDate" SET NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ClassroomBudget_classRoomId_startDate_idx" ON "ClassroomBudget"("classRoomId", "startDate");

-- CreateIndex
CREATE INDEX "ClassroomBudget_centerId_startDate_idx" ON "ClassroomBudget"("centerId", "startDate");
