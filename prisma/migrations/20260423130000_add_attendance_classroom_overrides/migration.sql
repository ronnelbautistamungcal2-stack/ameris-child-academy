ALTER TABLE "Attendance"
ADD COLUMN "classRoomId" TEXT;

UPDATE "Attendance" AS "attendance"
SET "classRoomId" = "child"."classRoomId"
FROM "Child" AS "child"
WHERE "child"."id" = "attendance"."childId"
  AND "attendance"."classRoomId" IS NULL;

CREATE INDEX "Attendance_centerId_day_classRoomId_idx"
ON "Attendance"("centerId", "day", "classRoomId");

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_classRoomId_fkey"
FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
