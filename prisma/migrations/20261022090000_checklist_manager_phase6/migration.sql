-- AlterTable
ALTER TABLE "DailyChecklist" ADD COLUMN     "noClassroom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailyChecklistLinkVisit" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChecklistLinkVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChecklistChoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyChecklistChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyChecklistLinkVisit_itemId_userId_date_key" ON "DailyChecklistLinkVisit"("itemId", "userId", "date");

-- CreateIndex
CREATE INDEX "DailyChecklistChoice_checklistId_idx" ON "DailyChecklistChoice"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChecklistChoice_userId_date_key" ON "DailyChecklistChoice"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyChecklistLinkVisit" ADD CONSTRAINT "DailyChecklistLinkVisit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DailyChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistLinkVisit" ADD CONSTRAINT "DailyChecklistLinkVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistChoice" ADD CONSTRAINT "DailyChecklistChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChecklistChoice" ADD CONSTRAINT "DailyChecklistChoice_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "DailyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A checklist assigned to several people becomes one copy per person, so one
-- person's ticks no longer show on another's list. The first assignee keeps
-- the original; each other assignee gets a copy with their own ticks and notes
-- moved over.
DO $$
DECLARE
  extra RECORD;
  new_checklist TEXT;
  old_item RECORD;
  new_item TEXT;
BEGIN
  FOR extra IN
    SELECT a."id" AS "assigneeId", a."checklistId", a."userId"
    FROM "DailyChecklistAssignee" a
    WHERE EXISTS (
      SELECT 1 FROM "DailyChecklistAssignee" b
      WHERE b."checklistId" = a."checklistId"
        AND (b."createdAt", b."id") < (a."createdAt", a."id")
    )
  LOOP
    new_checklist := gen_random_uuid()::text;
    INSERT INTO "DailyChecklist" ("id", "centerId", "classRoomId", "assignedUserId", "noClassroom", "title", "description", "category", "frequency", "repeatDays", "monthlyDay", "monthlyWeek", "monthlyWeekday", "active", "createdAt", "updatedAt")
    SELECT new_checklist, "centerId", "classRoomId", extra."userId", "noClassroom", "title", "description", "category", "frequency", "repeatDays", "monthlyDay", "monthlyWeek", "monthlyWeekday", "active", "createdAt", CURRENT_TIMESTAMP
    FROM "DailyChecklist" WHERE "id" = extra."checklistId";

    INSERT INTO "DailyChecklistClassroom" ("id", "checklistId", "classRoomId", "createdAt")
    SELECT gen_random_uuid()::text, new_checklist, "classRoomId", "createdAt"
    FROM "DailyChecklistClassroom" WHERE "checklistId" = extra."checklistId";

    FOR old_item IN SELECT * FROM "DailyChecklistItem" WHERE "checklistId" = extra."checklistId" LOOP
      new_item := gen_random_uuid()::text;
      INSERT INTO "DailyChecklistItem" ("id", "checklistId", "sortOrder", "title", "description", "frequency", "repeatDays", "monthlyDay", "monthlyWeek", "monthlyWeekday", "oneTimeDate", "lessonSource", "lessonSlot", "lessonCategoryId", "lessonId", "policyDocumentId", "policyLink", "mediaLink", "directLink", "directLinkLabel", "taskTime", "createdAt")
      VALUES (new_item, new_checklist, old_item."sortOrder", old_item."title", old_item."description", old_item."frequency", old_item."repeatDays", old_item."monthlyDay", old_item."monthlyWeek", old_item."monthlyWeekday", old_item."oneTimeDate", old_item."lessonSource", old_item."lessonSlot", old_item."lessonCategoryId", old_item."lessonId", old_item."policyDocumentId", old_item."policyLink", old_item."mediaLink", old_item."directLink", old_item."directLinkLabel", old_item."taskTime", old_item."createdAt");
      UPDATE "DailyChecklistCompletion" SET "itemId" = new_item
      WHERE "itemId" = old_item."id" AND "completedById" = extra."userId";
    END LOOP;

    UPDATE "DailyChecklistNote" SET "checklistId" = new_checklist
    WHERE "checklistId" = extra."checklistId" AND "createdById" = extra."userId";

    UPDATE "DailyChecklistAssignee" SET "checklistId" = new_checklist WHERE "id" = extra."assigneeId";
  END LOOP;

  UPDATE "DailyChecklist" c SET "assignedUserId" = a."userId"
  FROM "DailyChecklistAssignee" a
  WHERE a."checklistId" = c."id" AND c."assignedUserId" IS DISTINCT FROM a."userId";
END $$;
