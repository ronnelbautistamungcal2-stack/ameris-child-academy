-- CreateEnum
CREATE TYPE "BehaviorPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BehaviorGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'MET', 'NOT_MET');

-- CreateTable
CREATE TABLE "BehaviorPlan" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BehaviorPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorPlanGoal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetScore" INTEGER,
    "currentScore" INTEGER,
    "status" "BehaviorGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "strategies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lessonId" TEXT,
    "achievedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorPlanGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDomainScore" DOUBLE PRECISION,
    "goalsCompleted" INTEGER NOT NULL DEFAULT 0,
    "goalsFailed" INTEGER NOT NULL DEFAULT 0,
    "activityLogCount" INTEGER NOT NULL DEFAULT 0,
    "behaviorLogCount" INTEGER NOT NULL DEFAULT 0,
    "attendanceDays" INTEGER NOT NULL DEFAULT 0,
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviorPlan_childId_status_idx" ON "BehaviorPlan"("childId", "status");

-- CreateIndex
CREATE INDEX "BehaviorPlan_centerId_status_idx" ON "BehaviorPlan"("centerId", "status");

-- CreateIndex
CREATE INDEX "BehaviorPlan_createdById_idx" ON "BehaviorPlan"("createdById");

-- CreateIndex
CREATE INDEX "BehaviorPlanGoal_planId_sortOrder_idx" ON "BehaviorPlanGoal"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "BehaviorPlanGoal_planId_status_idx" ON "BehaviorPlanGoal"("planId", "status");

-- CreateIndex
CREATE INDEX "TeacherPerformanceSnapshot_centerId_period_idx" ON "TeacherPerformanceSnapshot"("centerId", "period");

-- CreateIndex
CREATE INDEX "TeacherPerformanceSnapshot_teacherId_period_idx" ON "TeacherPerformanceSnapshot"("teacherId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPerformanceSnapshot_teacherId_centerId_period_period_key" ON "TeacherPerformanceSnapshot"("teacherId", "centerId", "period", "periodType");

-- AddForeignKey
ALTER TABLE "BehaviorPlan" ADD CONSTRAINT "BehaviorPlan_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlan" ADD CONSTRAINT "BehaviorPlan_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlan" ADD CONSTRAINT "BehaviorPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlanGoal" ADD CONSTRAINT "BehaviorPlanGoal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BehaviorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorPlanGoal" ADD CONSTRAINT "BehaviorPlanGoal_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPerformanceSnapshot" ADD CONSTRAINT "TeacherPerformanceSnapshot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPerformanceSnapshot" ADD CONSTRAINT "TeacherPerformanceSnapshot_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
