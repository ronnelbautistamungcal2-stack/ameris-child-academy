-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "assignmentType" TEXT NOT NULL DEFAULT 'FAMILY',
ADD COLUMN     "ageMinMonths" INTEGER,
ADD COLUMN     "ageMaxMonths" INTEGER,
ADD COLUMN     "staffRoles" JSONB,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER;

-- Existing staff-facing templates keep a matching assignment target.
UPDATE "FormTemplate" SET "assignmentType" = 'STAFF' WHERE "targetRole" <> 'PARENT';
