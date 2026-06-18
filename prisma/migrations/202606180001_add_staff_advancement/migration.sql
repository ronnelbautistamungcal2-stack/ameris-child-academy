-- CreateTable
CREATE TABLE "StaffAdvancement" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAdvancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdvancementStep" (
    "id" TEXT NOT NULL,
    "advancementId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAdvancementStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAdvancement_centerId_category_idx" ON "StaffAdvancement"("centerId", "category");

-- CreateIndex
CREATE INDEX "StaffAdvancement_centerId_sortOrder_idx" ON "StaffAdvancement"("centerId", "sortOrder");

-- CreateIndex
CREATE INDEX "StaffAdvancementStep_advancementId_stepIndex_idx" ON "StaffAdvancementStep"("advancementId", "stepIndex");

-- AddForeignKey
ALTER TABLE "StaffAdvancement" ADD CONSTRAINT "StaffAdvancement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvancementStep" ADD CONSTRAINT "StaffAdvancementStep_advancementId_fkey" FOREIGN KEY ("advancementId") REFERENCES "StaffAdvancement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
