-- Curriculum types on lessons, steps and subscriber accounts (client 2026-11-07).
-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "types" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SubscriberAccount" ADD COLUMN     "curriculumTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Data: Ameris Academy (C-1001) keeps seeing every lesson.
UPDATE "SubscriberAccount" SET "curriculumTypes" = ARRAY['NON_DENOMINATIONAL','NON_DENOMINATIONAL_CHRISTIAN','OTHER'] WHERE "accountNumber" = 'C-1001';
-- An older Type that names one of the new types carries over.
UPDATE "Lesson" SET "types" = ARRAY['NON_DENOMINATIONAL'] WHERE lower(trim("type")) IN ('non-denominational', 'standard');
UPDATE "Lesson" SET "types" = ARRAY['NON_DENOMINATIONAL_CHRISTIAN'] WHERE lower(trim("type")) IN ('non-denominational christian', 'faith based', 'faith-based');
UPDATE "Lesson" SET "types" = ARRAY['OTHER'] WHERE lower(trim("type")) = 'other';
