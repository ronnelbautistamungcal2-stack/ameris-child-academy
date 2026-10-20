-- AlterTable
ALTER TABLE "Progress" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assessedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "Progress_childId_active_idx" ON "Progress"("childId", "active");

