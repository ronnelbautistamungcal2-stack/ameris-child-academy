-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "policyDocumentId" TEXT;

-- AlterTable
ALTER TABLE "PolicyDocument" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Lesson_policyDocumentId_idx" ON "Lesson"("policyDocumentId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
