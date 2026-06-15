CREATE TABLE "ChildFlagReview" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "snapshot" JSONB,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChildFlagReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChildFlagReview_flagKey_key" ON "ChildFlagReview"("flagKey");
CREATE INDEX "ChildFlagReview_centerId_closedAt_idx" ON "ChildFlagReview"("centerId", "closedAt");
CREATE INDEX "ChildFlagReview_childId_closedAt_idx" ON "ChildFlagReview"("childId", "closedAt");

ALTER TABLE "ChildFlagReview"
ADD CONSTRAINT "ChildFlagReview_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChildFlagReview"
ADD CONSTRAINT "ChildFlagReview_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChildFlagReview"
ADD CONSTRAINT "ChildFlagReview_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
