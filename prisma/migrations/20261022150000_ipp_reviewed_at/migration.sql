-- IPP "Needs Review" (client answer 2026-10-22): when the plan was last saved.
ALTER TABLE "BehaviorPlan" ADD COLUMN "reviewedAt" TIMESTAMP(3);
UPDATE "BehaviorPlan" SET "reviewedAt" = "updatedAt";
