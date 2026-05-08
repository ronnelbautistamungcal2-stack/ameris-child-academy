ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "TimeOffBalanceType" AS ENUM ('PAID', 'UNPAID');

CREATE TABLE "TimeOffBalanceEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "balanceType" "TimeOffBalanceType" NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "earnedDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffBalanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeOffBalanceEntry_userId_centerId_balanceType_earnedDate_idx"
ON "TimeOffBalanceEntry"("userId", "centerId", "balanceType", "earnedDate");

CREATE INDEX "TimeOffBalanceEntry_centerId_earnedDate_idx"
ON "TimeOffBalanceEntry"("centerId", "earnedDate");

ALTER TABLE "TimeOffBalanceEntry"
ADD CONSTRAINT "TimeOffBalanceEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeOffBalanceEntry"
ADD CONSTRAINT "TimeOffBalanceEntry_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeOffBalanceEntry"
ADD CONSTRAINT "TimeOffBalanceEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
