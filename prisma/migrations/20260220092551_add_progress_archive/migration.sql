-- CreateTable
CREATE TABLE "ProgressArchive" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedById" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "ProgressArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressArchive_centerId_schoolYear_idx" ON "ProgressArchive"("centerId", "schoolYear");

-- CreateIndex
CREATE INDEX "ProgressArchive_childId_schoolYear_idx" ON "ProgressArchive"("childId", "schoolYear");
