-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('PHOTO_RELEASE', 'FIELD_TRIP', 'MEDICAL_TREATMENT', 'TRANSPORTATION', 'SUNSCREEN_APPLICATION', 'WATER_ACTIVITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'REVOKED');

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "enrollmentEndDate" TIMESTAMP(3),
ADD COLUMN     "enrollmentStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "appliedById" TEXT,
ADD COLUMN     "appliedToChild" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "autoFillMapping" JSONB;

-- CreateTable
CREATE TABLE "ChildPermission" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "permissionType" "PermissionType" NOT NULL,
    "status" "PermissionStatus" NOT NULL DEFAULT 'PENDING',
    "grantedById" TEXT,
    "notes" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),
    "formSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSupply" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "category" TEXT NOT NULL DEFAULT 'General',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonSupply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildPermission_childId_status_idx" ON "ChildPermission"("childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChildPermission_childId_permissionType_key" ON "ChildPermission"("childId", "permissionType");

-- CreateIndex
CREATE INDEX "LessonSupply_lessonId_idx" ON "LessonSupply"("lessonId");

-- CreateIndex
CREATE INDEX "LessonSupply_category_idx" ON "LessonSupply"("category");

-- AddForeignKey
ALTER TABLE "ChildPermission" ADD CONSTRAINT "ChildPermission_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildPermission" ADD CONSTRAINT "ChildPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildPermission" ADD CONSTRAINT "ChildPermission_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSupply" ADD CONSTRAINT "LessonSupply_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
