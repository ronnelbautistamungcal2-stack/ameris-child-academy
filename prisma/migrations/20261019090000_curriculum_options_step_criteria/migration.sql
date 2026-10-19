-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "criteria" JSONB,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "CurriculumOption" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumOption_centerId_kind_name_key" ON "CurriculumOption"("centerId", "kind", "name");

-- AddForeignKey
ALTER TABLE "CurriculumOption" ADD CONSTRAINT "CurriculumOption_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

