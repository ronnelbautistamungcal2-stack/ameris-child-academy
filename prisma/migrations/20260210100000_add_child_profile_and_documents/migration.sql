-- AlterTable
ALTER TABLE "Child"
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "healthAssessmentDocuments" JSONB,
ADD COLUMN     "enrollmentDocuments" JSONB,
ADD COLUMN     "feedingPlan" JSONB;

