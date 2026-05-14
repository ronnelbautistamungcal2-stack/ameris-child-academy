CREATE TABLE "DailyChecklistClassroom" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChecklistClassroom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyChecklistClassroom_checklistId_classRoomId_key"
ON "DailyChecklistClassroom"("checklistId", "classRoomId");

CREATE INDEX "DailyChecklistClassroom_classRoomId_idx"
ON "DailyChecklistClassroom"("classRoomId");

ALTER TABLE "DailyChecklistClassroom"
ADD CONSTRAINT "DailyChecklistClassroom_checklistId_fkey"
FOREIGN KEY ("checklistId") REFERENCES "DailyChecklist"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DailyChecklistClassroom"
ADD CONSTRAINT "DailyChecklistClassroom_classRoomId_fkey"
FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

INSERT INTO "DailyChecklistClassroom" ("id", "checklistId", "classRoomId", "createdAt")
SELECT gen_random_uuid()::text, "id", "classRoomId", CURRENT_TIMESTAMP
FROM "DailyChecklist"
WHERE "classRoomId" IS NOT NULL
ON CONFLICT ("checklistId", "classRoomId") DO NOTHING;
