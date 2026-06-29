-- CreateTable
CREATE TABLE "StaffCommendation" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCitation" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherStaffGradeConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "evaluationWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "checklistWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "lateDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "absenceDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtherStaffGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffCommendation_staffId_date_idx" ON "StaffCommendation"("staffId", "date");
CREATE INDEX "StaffCommendation_centerId_date_idx" ON "StaffCommendation"("centerId", "date");
CREATE INDEX "StaffCitation_staffId_date_idx" ON "StaffCitation"("staffId", "date");
CREATE INDEX "StaffCitation_centerId_date_idx" ON "StaffCitation"("centerId", "date");
CREATE UNIQUE INDEX "OtherStaffGradeConfig_centerId_key" ON "OtherStaffGradeConfig"("centerId");

-- AddForeignKey
ALTER TABLE "StaffCommendation" ADD CONSTRAINT "StaffCommendation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffCommendation" ADD CONSTRAINT "StaffCommendation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffCommendation" ADD CONSTRAINT "StaffCommendation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffCitation" ADD CONSTRAINT "StaffCitation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffCitation" ADD CONSTRAINT "StaffCitation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffCitation" ADD CONSTRAINT "StaffCitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OtherStaffGradeConfig" ADD CONSTRAINT "OtherStaffGradeConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
