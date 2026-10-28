-- CreateTable
CREATE TABLE "ComplianceRequirement" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "repeatOn" INTEGER,
    "appliesToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "nextDue" DATE NOT NULL,
    "lastCompletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCompletion" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" TEXT,

    CONSTRAINT "ComplianceCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceRequirement_centerId_nextDue_idx" ON "ComplianceRequirement"("centerId", "nextDue");

-- CreateIndex
CREATE INDEX "ComplianceCompletion_requirementId_completedAt_idx" ON "ComplianceCompletion"("requirementId", "completedAt");

-- AddForeignKey
ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCompletion" ADD CONSTRAINT "ComplianceCompletion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ComplianceRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

