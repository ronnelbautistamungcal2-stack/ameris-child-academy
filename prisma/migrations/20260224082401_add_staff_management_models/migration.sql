-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PTO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "certificateUrl" TEXT,
    "certificateFileName" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomBudget" (
    "id" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetExpense" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "receipt" TEXT,
    "receiptFileName" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherEvaluation" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "overallScore" DOUBLE PRECISION,
    "categories" JSONB,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "goals" TEXT,
    "notes" TEXT,
    "teacherAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendance_centerId_date_idx" ON "StaffAttendance"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON "StaffAttendance"("userId", "date");

-- CreateIndex
CREATE INDEX "TimeOffRequest_userId_status_idx" ON "TimeOffRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "TimeOffRequest_centerId_startDate_idx" ON "TimeOffRequest"("centerId", "startDate");

-- CreateIndex
CREATE INDEX "TrainingLog_userId_date_idx" ON "TrainingLog"("userId", "date");

-- CreateIndex
CREATE INDEX "TrainingLog_centerId_date_idx" ON "TrainingLog"("centerId", "date");

-- CreateIndex
CREATE INDEX "ClassroomBudget_centerId_month_idx" ON "ClassroomBudget"("centerId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomBudget_classRoomId_month_key" ON "ClassroomBudget"("classRoomId", "month");

-- CreateIndex
CREATE INDEX "BudgetExpense_budgetId_date_idx" ON "BudgetExpense"("budgetId", "date");

-- CreateIndex
CREATE INDEX "TeacherEvaluation_teacherId_period_idx" ON "TeacherEvaluation"("teacherId", "period");

-- CreateIndex
CREATE INDEX "TeacherEvaluation_centerId_period_idx" ON "TeacherEvaluation"("centerId", "period");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLog" ADD CONSTRAINT "TrainingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLog" ADD CONSTRAINT "TrainingLog_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLog" ADD CONSTRAINT "TrainingLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomBudget" ADD CONSTRAINT "ClassroomBudget_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomBudget" ADD CONSTRAINT "ClassroomBudget_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetExpense" ADD CONSTRAINT "BudgetExpense_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ClassroomBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetExpense" ADD CONSTRAINT "BudgetExpense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEvaluation" ADD CONSTRAINT "TeacherEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEvaluation" ADD CONSTRAINT "TeacherEvaluation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEvaluation" ADD CONSTRAINT "TeacherEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
