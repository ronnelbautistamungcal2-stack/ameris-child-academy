-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "ageRates" JSONB,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "careSchedule" JSONB,
ADD COLUMN     "centerType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "classroomCount" INTEGER,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "directorId" TEXT,
ADD COLUMN     "enrollmentFee" DOUBLE PRECISION,
ADD COLUMN     "mealAgeGroups" JSONB,
ADD COLUMN     "meals" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "roleAccess" "Role"[] DEFAULT ARRAY[]::"Role"[],
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "zip" TEXT;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

