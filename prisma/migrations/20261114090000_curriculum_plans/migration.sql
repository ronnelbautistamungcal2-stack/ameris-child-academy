-- Curriculum plans by age range and type (client sheet 10-29, rows 3/4).
-- AlterTable
ALTER TABLE "LessonPlanCell" ADD COLUMN     "planId" TEXT,
ALTER COLUMN "classRoomId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LessonPlanRow" ADD COLUMN     "planId" TEXT,
ALTER COLUMN "classRoomId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CurriculumPlan" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "theme" TEXT,
    "dayCount" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumPlan_centerId_ageRange_type_key" ON "CurriculumPlan"("centerId", "ageRange", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanCell_planId_day_rowIndex_key" ON "LessonPlanCell"("planId", "day", "rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanRow_planId_rowIndex_key" ON "LessonPlanRow"("planId", "rowIndex");

-- AddForeignKey
ALTER TABLE "LessonPlanCell" ADD CONSTRAINT "LessonPlanCell_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CurriculumPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumPlan" ADD CONSTRAINT "CurriculumPlan_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanRow" ADD CONSTRAINT "LessonPlanRow_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CurriculumPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A subscriber classroom's age group is now an age range name, not a source
-- classroom id, so it no longer references ClassRoom.
ALTER TABLE "ClassRoom" DROP CONSTRAINT IF EXISTS "ClassRoom_curriculumAgeGroupId_fkey";

-- ---------------------------------------------------------------------------
-- Data (client sheet 10-29, rows 3/4): the curriculum source center's
-- age-group classrooms become curriculum plans named after the classroom,
-- with their planner rows, lessons, theme and day count copied. The classroom
-- planners stay as they were. A name used by two classrooms keeps the one
-- with the most lessons.

CREATE TEMP TABLE "_plan_source" AS
SELECT DISTINCT ON (c."centerId", btrim(c."name"))
       c."id" AS room_id, c."centerId" AS center_id, btrim(c."name") AS age
FROM "ClassRoom" c
JOIN "Center" ce ON ce."id" = c."centerId" AND ce."curriculumSource" = true
WHERE btrim(c."name") <> ''
ORDER BY c."centerId", btrim(c."name"),
         (SELECT count(*) FROM "LessonPlanCell" x WHERE x."classRoomId" = c."id") DESC,
         c."id";

INSERT INTO "CurriculumPlan" ("id", "centerId", "ageRange", "type", "theme", "dayCount", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || s.room_id)::uuid::text, s.center_id, s.age, '',
       lp."theme", COALESCE(lp."dayCount", 10), NOW(), NOW()
FROM "_plan_source" s
LEFT JOIN "LessonPlanner" lp ON lp."classRoomId" = s.room_id
ON CONFLICT ("centerId", "ageRange", "type") DO NOTHING;

INSERT INTO "LessonPlanRow" ("id", "centerId", "classRoomId", "planId", "rowIndex", "label", "position", "active", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id")::uuid::text, r."centerId", NULL, p."id",
       r."rowIndex", r."label", r."position", r."active", NOW(), NOW()
FROM "_plan_source" s
JOIN "LessonPlanRow" r ON r."classRoomId" = s.room_id
JOIN "CurriculumPlan" p ON p."centerId" = s.center_id AND p."ageRange" = s.age AND p."type" = ''
ON CONFLICT DO NOTHING;

INSERT INTO "LessonPlanCell" ("id", "centerId", "classRoomId", "planId", "day", "rowIndex", "lessonId", "title", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || x."id")::uuid::text, x."centerId", NULL, p."id",
       x."day", x."rowIndex", x."lessonId", x."title", NOW(), NOW()
FROM "_plan_source" s
JOIN "LessonPlanCell" x ON x."classRoomId" = s.room_id
JOIN "CurriculumPlan" p ON p."centerId" = s.center_id AND p."ageRange" = s.age AND p."type" = ''
ON CONFLICT DO NOTHING;

-- The plan names join the Categories > Age Range list.
INSERT INTO "CurriculumOption" ("id", "centerId", "kind", "name", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || s.room_id || 'age')::uuid::text, s.center_id, 'AGE_RANGE', s.age, NOW()
FROM "_plan_source" s
ON CONFLICT ("centerId", "kind", "name") DO NOTHING;

-- Subscribers' age groups were source classroom ids; they are now age range names.
UPDATE "SubscriberAccount" a
SET "curriculumAgeGroups" = COALESCE((
      SELECT array_agg(DISTINCT COALESCE(btrim(c."name"), g))
      FROM unnest(a."curriculumAgeGroups") AS g
      LEFT JOIN "ClassRoom" c ON c."id" = g
    ), '{}')
WHERE cardinality(a."curriculumAgeGroups") > 0;

UPDATE "ClassRoom" r
SET "curriculumAgeGroupId" = btrim(c."name")
FROM "ClassRoom" c
WHERE r."curriculumAgeGroupId" = c."id";

DROP TABLE "_plan_source";
