-- CreateEnum
CREATE TYPE "OutboundEmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'EMAIL_SENT');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Progress" ADD COLUMN     "lessonGoalId" TEXT;

-- CreateTable
CREATE TABLE "ChildGuardian" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "receivesUpdates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCategory" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonGoal" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "goalIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingCriteria" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonRemediation" (
    "id" TEXT NOT NULL,
    "fromLessonId" TEXT NOT NULL,
    "toLessonId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonRemediation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressEntry" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "notes" TEXT,
    "details" JSONB,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recordedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "childId" TEXT,
    "createdById" TEXT,
    "to" TEXT NOT NULL,
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "template" TEXT,
    "payload" JSONB,
    "status" "OutboundEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildGuardian_guardianId_idx" ON "ChildGuardian"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildGuardian_childId_guardianId_key" ON "ChildGuardian"("childId", "guardianId");

-- CreateIndex
CREATE INDEX "LessonCategory_centerId_sortOrder_idx" ON "LessonCategory"("centerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCategory_centerId_name_key" ON "LessonCategory"("centerId", "name");

-- CreateIndex
CREATE INDEX "LessonGoal_lessonId_active_idx" ON "LessonGoal"("lessonId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LessonGoal_lessonId_goalIndex_key" ON "LessonGoal"("lessonId", "goalIndex");

-- CreateIndex
CREATE INDEX "LessonRemediation_fromLessonId_idx" ON "LessonRemediation"("fromLessonId");

-- CreateIndex
CREATE INDEX "LessonRemediation_toLessonId_idx" ON "LessonRemediation"("toLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonRemediation_fromLessonId_toLessonId_key" ON "LessonRemediation"("fromLessonId", "toLessonId");

-- CreateIndex
CREATE INDEX "ProgressEntry_progressId_occurredAt_idx" ON "ProgressEntry"("progressId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProgressEntry_recordedById_occurredAt_idx" ON "ProgressEntry"("recordedById", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_centerId_createdAt_idx" ON "AuditLog"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "OutboundEmail_status_scheduledAt_idx" ON "OutboundEmail"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "OutboundEmail_centerId_createdAt_idx" ON "OutboundEmail"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundEmail_childId_createdAt_idx" ON "OutboundEmail"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "Progress_childId_status_idx" ON "Progress"("childId", "status");

-- CreateIndex
CREATE INDEX "Progress_lessonId_status_idx" ON "Progress"("lessonId", "status");

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCategory" ADD CONSTRAINT "LessonCategory_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LessonCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonGoal" ADD CONSTRAINT "LessonGoal_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonRemediation" ADD CONSTRAINT "LessonRemediation_fromLessonId_fkey" FOREIGN KEY ("fromLessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonRemediation" ADD CONSTRAINT "LessonRemediation_toLessonId_fkey" FOREIGN KEY ("toLessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonGoalId_fkey" FOREIGN KEY ("lessonGoalId") REFERENCES "LessonGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "Progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
