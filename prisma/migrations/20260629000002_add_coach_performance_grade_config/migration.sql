-- CreateTable
CREATE TABLE "CoachPerformanceGradeConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "teamPerformanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "evaluationWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "lateDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "absenceDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachPerformanceGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachPerformanceGradeConfig_centerId_key" ON "CoachPerformanceGradeConfig"("centerId");

-- AddForeignKey
ALTER TABLE "CoachPerformanceGradeConfig" ADD CONSTRAINT "CoachPerformanceGradeConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
