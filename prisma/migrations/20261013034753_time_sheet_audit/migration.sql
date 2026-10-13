-- CreateTable
CREATE TABLE "TimeSheetAudit" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "childId" TEXT,
    "userId" TEXT,
    "recordId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "originalIn" TIMESTAMP(3),
    "originalInBy" TEXT,
    "originalOut" TIMESTAMP(3),
    "originalOutBy" TEXT,
    "action" TEXT NOT NULL,
    "newValue" TIMESTAMP(3),
    "changedById" TEXT,
    "changedByInitials" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeSheetAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeSheetAudit_kind_childId_day_idx" ON "TimeSheetAudit"("kind", "childId", "day");

-- CreateIndex
CREATE INDEX "TimeSheetAudit_kind_userId_day_idx" ON "TimeSheetAudit"("kind", "userId", "day");

