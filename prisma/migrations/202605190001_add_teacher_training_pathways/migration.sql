CREATE TABLE "TeacherTrainingPathway" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherTrainingPathway_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherTrainingTopic" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resourceUrl" TEXT,
    "durationHours" DOUBLE PRECISION,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherTrainingTopic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherTrainingPathway_centerId_active_effectiveDate_idx"
ON "TeacherTrainingPathway"("centerId", "active", "effectiveDate");

CREATE INDEX "TeacherTrainingPathway_createdById_idx"
ON "TeacherTrainingPathway"("createdById");

CREATE INDEX "TeacherTrainingTopic_pathwayId_sortOrder_idx"
ON "TeacherTrainingTopic"("pathwayId", "sortOrder");

ALTER TABLE "TeacherTrainingPathway"
ADD CONSTRAINT "TeacherTrainingPathway_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherTrainingPathway"
ADD CONSTRAINT "TeacherTrainingPathway_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherTrainingTopic"
ADD CONSTRAINT "TeacherTrainingTopic_pathwayId_fkey"
FOREIGN KEY ("pathwayId") REFERENCES "TeacherTrainingPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
