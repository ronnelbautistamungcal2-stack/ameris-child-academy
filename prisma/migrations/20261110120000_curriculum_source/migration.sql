-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "curriculumSource" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ClassRoom" ADD COLUMN     "curriculumAgeGroupId" TEXT;

-- AlterTable
ALTER TABLE "SubscriberAccount" ADD COLUMN     "curriculumAgeGroups" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_curriculumAgeGroupId_fkey" FOREIGN KEY ("curriculumAgeGroupId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The Ameris curriculum center: the center with the most lessons and steps,
-- preferring the Ameris account (C-1001). Global admin can change it later.
UPDATE "Center" SET "curriculumSource" = true
WHERE "id" = (
  SELECT c."id"
  FROM "Center" c
  LEFT JOIN "SubscriberAccount" a ON a."id" = c."subscriberAccountId"
  LEFT JOIN "Lesson" l ON l."centerId" = c."id"
  GROUP BY c."id", a."accountNumber"
  ORDER BY (a."accountNumber" = 'C-1001') DESC NULLS LAST, COUNT(l."id") DESC, MIN(c."name")
  LIMIT 1
);
