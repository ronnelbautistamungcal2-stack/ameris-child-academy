CREATE TABLE "DailyChecklistAssignee" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChecklistAssignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyChecklistAssignee_checklistId_userId_key"
ON "DailyChecklistAssignee"("checklistId", "userId");

CREATE INDEX "DailyChecklistAssignee_userId_idx"
ON "DailyChecklistAssignee"("userId");

ALTER TABLE "DailyChecklistAssignee"
ADD CONSTRAINT "DailyChecklistAssignee_checklistId_fkey"
FOREIGN KEY ("checklistId") REFERENCES "DailyChecklist"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DailyChecklistAssignee"
ADD CONSTRAINT "DailyChecklistAssignee_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

INSERT INTO "DailyChecklistAssignee" ("id", "checklistId", "userId", "createdAt")
SELECT gen_random_uuid()::text, "id", "assignedUserId", CURRENT_TIMESTAMP
FROM "DailyChecklist"
WHERE "assignedUserId" IS NOT NULL
ON CONFLICT ("checklistId", "userId") DO NOTHING;
