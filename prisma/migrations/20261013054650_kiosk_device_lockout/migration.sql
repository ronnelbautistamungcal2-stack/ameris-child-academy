-- AlterTable
ALTER TABLE "KioskDevice" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureWindowStart" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

