-- CreateTable
CREATE TABLE "TeacherCommendation" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCitation" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceGradeConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "citizenshipWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "evaluationWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "checklistWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "lateDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "absenceDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherCommendation_teacherId_date_idx" ON "TeacherCommendation"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherCommendation_centerId_date_idx" ON "TeacherCommendation"("centerId", "date");

-- CreateIndex
CREATE INDEX "TeacherCitation_teacherId_date_idx" ON "TeacherCitation"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherCitation_centerId_date_idx" ON "TeacherCitation"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceGradeConfig_centerId_key" ON "PerformanceGradeConfig"("centerId");

-- AddForeignKey
ALTER TABLE "TeacherCommendation" ADD CONSTRAINT "TeacherCommendation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCommendation" ADD CONSTRAINT "TeacherCommendation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCommendation" ADD CONSTRAINT "TeacherCommendation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCitation" ADD CONSTRAINT "TeacherCitation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCitation" ADD CONSTRAINT "TeacherCitation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCitation" ADD CONSTRAINT "TeacherCitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGradeConfig" ADD CONSTRAINT "PerformanceGradeConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
