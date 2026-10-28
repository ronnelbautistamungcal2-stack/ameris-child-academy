-- CreateTable
CREATE TABLE "FormRenewalNote" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRenewalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormRenewalNote_templateId_childId_key" ON "FormRenewalNote"("templateId", "childId");

