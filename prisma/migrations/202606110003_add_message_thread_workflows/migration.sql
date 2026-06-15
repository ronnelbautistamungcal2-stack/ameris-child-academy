CREATE TYPE "MessageThreadType" AS ENUM ('MESSAGE', 'OPEN_POINT', 'REQUEST', 'ACCOMMODATION');
CREATE TYPE "MessageThreadStatus" AS ENUM ('OPEN', 'READY_FOR_REVIEW', 'COMPLETED');
CREATE TYPE "MessagePriorityLevel" AS ENUM ('A', 'B', 'C');

ALTER TABLE "MessageThread"
ADD COLUMN     "type" "MessageThreadType" NOT NULL DEFAULT 'MESSAGE',
ADD COLUMN     "status" "MessageThreadStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "priority" "MessagePriorityLevel",
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "reviewRequestedById" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

UPDATE "MessageThread"
SET "createdById" = sub."senderId"
FROM (
  SELECT DISTINCT ON ("threadId") "threadId", "senderId"
  FROM "Message"
  ORDER BY "threadId", "createdAt" ASC
) AS sub
WHERE "MessageThread"."id" = sub."threadId"
  AND "MessageThread"."createdById" IS NULL;

UPDATE "MessageThread"
SET "createdById" = participant."userId"
FROM (
  SELECT DISTINCT ON ("threadId") "threadId", "userId"
  FROM "ThreadParticipant"
  ORDER BY "threadId", "createdAt" ASC
) AS participant
WHERE "MessageThread"."id" = participant."threadId"
  AND "MessageThread"."createdById" IS NULL;

ALTER TABLE "MessageThread"
ALTER COLUMN "createdById" SET NOT NULL;

CREATE INDEX "MessageThread_centerId_type_status_idx" ON "MessageThread"("centerId", "type", "status");
CREATE INDEX "MessageThread_createdById_createdAt_idx" ON "MessageThread"("createdById", "createdAt");
CREATE INDEX "MessageThread_completedAt_idx" ON "MessageThread"("completedAt");
CREATE INDEX "MessageThread_dueDate_idx" ON "MessageThread"("dueDate");

ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_reviewRequestedById_fkey" FOREIGN KEY ("reviewRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
