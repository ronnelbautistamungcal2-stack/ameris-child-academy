-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "carePlan" JSONB,
ADD COLUMN     "healthInfo" JSONB,
ADD COLUMN     "languages" TEXT,
ADD COLUMN     "outOfAreaContact" JSONB,
ADD COLUMN     "schedule" JSONB;

