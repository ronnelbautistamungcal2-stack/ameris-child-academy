-- AlterTable
ALTER TABLE "BehaviorPlan"
ADD COLUMN     "teacherTactics" TEXT,
ADD COLUMN     "parentTactics" TEXT,
ADD COLUMN     "coachTactics" TEXT,
ADD COLUMN     "disciplinaryAction" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "parentApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "parentSignatureName" TEXT;

-- AddForeignKey
ALTER TABLE "BehaviorPlan" ADD CONSTRAINT "BehaviorPlan_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
