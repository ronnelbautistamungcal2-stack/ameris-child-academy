-- CreateTable
CREATE TABLE "ParentFaq" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentFaq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentFaq_centerId_idx" ON "ParentFaq"("centerId");

-- CreateIndex
CREATE INDEX "ParentFaq_topic_idx" ON "ParentFaq"("topic");

-- AddForeignKey
ALTER TABLE "ParentFaq" ADD CONSTRAINT "ParentFaq_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
