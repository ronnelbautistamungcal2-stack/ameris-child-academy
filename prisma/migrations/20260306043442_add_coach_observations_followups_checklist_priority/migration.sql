-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('CAMERA', 'IN_CLASS');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('PARENT', 'CAMERA_OBSERVATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "MilestoneChecklistItem" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "priority" "Priority";

-- CreateTable
CREATE TABLE "CoachObservation" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "ObservationType" NOT NULL,
    "classRoomId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "score" DOUBLE PRECISION,
    "strengths" TEXT,
    "improvements" TEXT,
    "actionItems" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachFollowUp" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "type" "FollowUpType" NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachObservation_coachId_date_idx" ON "CoachObservation"("coachId", "date");

-- CreateIndex
CREATE INDEX "CoachObservation_teacherId_date_idx" ON "CoachObservation"("teacherId", "date");

-- CreateIndex
CREATE INDEX "CoachObservation_centerId_date_idx" ON "CoachObservation"("centerId", "date");

-- CreateIndex
CREATE INDEX "CoachFollowUp_centerId_status_idx" ON "CoachFollowUp"("centerId", "status");

-- CreateIndex
CREATE INDEX "CoachFollowUp_createdById_status_idx" ON "CoachFollowUp"("createdById", "status");

-- CreateIndex
CREATE INDEX "CoachFollowUp_assignedToId_status_idx" ON "CoachFollowUp"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "CoachFollowUp_dueDate_idx" ON "CoachFollowUp"("dueDate");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_assignedToId_idx" ON "MilestoneChecklistItem"("assignedToId");

-- CreateIndex
CREATE INDEX "MilestoneChecklistItem_dueAt_idx" ON "MilestoneChecklistItem"("dueAt");

-- AddForeignKey
ALTER TABLE "MilestoneChecklistItem" ADD CONSTRAINT "MilestoneChecklistItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollowUp" ADD CONSTRAINT "CoachFollowUp_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollowUp" ADD CONSTRAINT "CoachFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollowUp" ADD CONSTRAINT "CoachFollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
