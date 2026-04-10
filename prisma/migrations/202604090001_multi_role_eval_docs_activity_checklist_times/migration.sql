-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'INCIDENT';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "roles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];

UPDATE "User"
SET "roles" = ARRAY["role"]::"Role"[]
WHERE "roles" IS NULL OR cardinality("roles") = 0;

-- AlterTable
ALTER TABLE "TeacherEvaluation"
ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TeacherEvaluation_centerId_periodStart_periodEnd_idx"
ON "TeacherEvaluation"("centerId", "periodStart", "periodEnd");

-- AlterTable
ALTER TABLE "Child"
ADD COLUMN IF NOT EXISTS "iefDocuments" JSONB,
ADD COLUMN IF NOT EXISTS "immunizationDocuments" JSONB,
ADD COLUMN IF NOT EXISTS "infantDocuments" JSONB,
ADD COLUMN IF NOT EXISTS "otherDocuments" JSONB;

-- Alter LessonCategory uniqueness so the same category name can exist per age range.
DROP INDEX IF EXISTS "LessonCategory_centerId_name_key";

CREATE INDEX IF NOT EXISTS "LessonCategory_centerId_name_ageRange_idx"
ON "LessonCategory"("centerId", "name", "ageRange");

-- Alter task tables
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "taskTime" TEXT;

ALTER TABLE "DailyChecklistItem"
ADD COLUMN IF NOT EXISTS "taskTime" TEXT;

CREATE INDEX IF NOT EXISTS "DailyChecklistItem_checklistId_taskTime_idx"
ON "DailyChecklistItem"("checklistId", "taskTime");
