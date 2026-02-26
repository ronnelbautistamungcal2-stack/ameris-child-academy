-- CreateEnum
CREATE TYPE "ArchiveType" AS ENUM ('PROGRESS', 'FULL_RECORD');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FORM_RENEWAL';

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "renewedById" TEXT;

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "renewalPeriodDays" INTEGER,
ADD COLUMN     "requiresRenewal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DataArchive" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "archiveType" "ArchiveType" NOT NULL DEFAULT 'FULL_RECORD',
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedById" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "DataArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataArchive_centerId_schoolYear_idx" ON "DataArchive"("centerId", "schoolYear");

-- CreateIndex
CREATE INDEX "DataArchive_childId_schoolYear_idx" ON "DataArchive"("childId", "schoolYear");

-- CreateIndex
CREATE INDEX "DataArchive_archiveType_centerId_idx" ON "DataArchive"("archiveType", "centerId");
