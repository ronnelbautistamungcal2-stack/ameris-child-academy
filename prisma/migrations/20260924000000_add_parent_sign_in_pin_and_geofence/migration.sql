-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "signInRadiusMeters" INTEGER NOT NULL DEFAULT 1609;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signInPinHash" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkedInById" TEXT,
ADD COLUMN     "checkedOutById" TEXT;
