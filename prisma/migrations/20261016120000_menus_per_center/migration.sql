-- Menus become per center, and each line is either the admin's PLANNED menu
-- or what the kitchen actually SERVED.

-- DropIndex
DROP INDEX "MenuItem_date_idx";

-- DropIndex
DROP INDEX "MenuItem_date_meal_ageGroup_component_key";

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "centerId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'PLANNED';

-- The menu used to be shared by every center: give each center its own copy.
INSERT INTO "MenuItem" ("id", "date", "meal", "ageGroup", "component", "item", "kind", "centerId", "updatedById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m."date", m."meal", m."ageGroup", m."component", m."item", 'PLANNED', c."id", m."updatedById", m."createdAt", m."updatedAt"
FROM "MenuItem" m
CROSS JOIN "Center" c
WHERE m."centerId" IS NULL;

DELETE FROM "MenuItem" WHERE "centerId" IS NULL;

ALTER TABLE "MenuItem" ALTER COLUMN "centerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "MenuItem_centerId_date_idx" ON "MenuItem"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_centerId_date_meal_ageGroup_component_kind_key" ON "MenuItem"("centerId", "date", "meal", "ageGroup", "component", "kind");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
