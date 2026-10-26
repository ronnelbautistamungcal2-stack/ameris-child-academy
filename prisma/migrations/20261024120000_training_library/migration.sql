-- DropForeignKey
ALTER TABLE "TeacherTrainingTopic" DROP CONSTRAINT "TeacherTrainingTopic_pathwayId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherTrainingTopicCompletion" DROP CONSTRAINT "TeacherTrainingTopicCompletion_topicId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherTrainingTopicCompletion" DROP CONSTRAINT "TeacherTrainingTopicCompletion_teacherId_fkey";

-- AlterTable
ALTER TABLE "TrainingLog" ADD COLUMN     "interactiveHours" DOUBLE PRECISION,
ADD COLUMN     "nonInteractiveHours" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "TeacherTrainingPathway" ADD COLUMN     "ageGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "appliesToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "category" TEXT,
ADD COLUMN     "materials" JSONB,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "TrainingItem" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'REQUIRED',
    "appliesToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "hours" DOUBLE PRECISION,
    "observationRequired" BOOLEAN NOT NULL DEFAULT false,
    "handsOnRequired" BOOLEAN NOT NULL DEFAULT false,
    "materials" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPathwayItem" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "trainingItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingPathwayItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "materialsViewed" JSONB,
    "observationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "handsOnStatus" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingItem_centerId_idx" ON "TrainingItem"("centerId");

-- CreateIndex
CREATE INDEX "TrainingPathwayItem_trainingItemId_idx" ON "TrainingPathwayItem"("trainingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPathwayItem_pathwayId_trainingItemId_key" ON "TrainingPathwayItem"("pathwayId", "trainingItemId");

-- CreateIndex
CREATE INDEX "TrainingProgress_trainingItemId_idx" ON "TrainingProgress"("trainingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgress_userId_trainingItemId_key" ON "TrainingProgress"("userId", "trainingItemId");

-- AddForeignKey
ALTER TABLE "TrainingItem" ADD CONSTRAINT "TrainingItem_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPathwayItem" ADD CONSTRAINT "TrainingPathwayItem_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "TeacherTrainingPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPathwayItem" ADD CONSTRAINT "TrainingPathwayItem_trainingItemId_fkey" FOREIGN KEY ("trainingItemId") REFERENCES "TrainingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_trainingItemId_fkey" FOREIGN KEY ("trainingItemId") REFERENCES "TrainingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Old pathway topics become Training Library items linked to their pathway;
-- completions become completed progress.
INSERT INTO "TrainingItem" ("id", "centerId", "title", "category", "description", "type", "hours", "materials", "createdAt", "updatedAt")
SELECT t."id", p."centerId", t."title", 'General', COALESCE(t."description", t."notes"),
       CASE WHEN t."required" THEN 'REQUIRED' ELSE 'OPTIONAL' END, t."durationHours",
       CASE WHEN t."resourceUrl" IS NOT NULL AND t."resourceUrl" <> '' THEN jsonb_build_array(jsonb_build_object('kind', 'LINK', 'name', 'Resource', 'url', t."resourceUrl")) END,
       t."createdAt", t."updatedAt"
FROM "TeacherTrainingTopic" t JOIN "TeacherTrainingPathway" p ON p."id" = t."pathwayId";

INSERT INTO "TrainingPathwayItem" ("id", "pathwayId", "trainingItemId", "sortOrder")
SELECT gen_random_uuid()::text, t."pathwayId", t."id", t."sortOrder" FROM "TeacherTrainingTopic" t;

INSERT INTO "TrainingProgress" ("id", "userId", "trainingItemId", "status", "startedAt", "completedAt", "acknowledgedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."teacherId", c."topicId", 'COMPLETED', c."completedAt", c."completedAt", c."completedAt", c."createdAt", CURRENT_TIMESTAMP
FROM "TeacherTrainingTopicCompletion" c;

-- DropTable
DROP TABLE "TeacherTrainingTopicCompletion";

-- DropTable
DROP TABLE "TeacherTrainingTopic";
