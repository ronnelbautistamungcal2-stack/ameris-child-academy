-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GLOBAL_ADMIN';

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "subscriberAccountId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriberAccountId" TEXT;

-- CreateTable
CREATE TABLE "SubscriberAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxCenters" INTEGER NOT NULL DEFAULT 1,
    "maxChildren" INTEGER,
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriberAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriberAccountNote" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "authorId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriberAccountNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriberAccount_accountNumber_key" ON "SubscriberAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "SubscriberAccountNote_accountId_idx" ON "SubscriberAccountNote"("accountId");

-- CreateIndex
CREATE INDEX "User_subscriberAccountId_idx" ON "User"("subscriberAccountId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberAccountNote" ADD CONSTRAINT "SubscriberAccountNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SubscriberAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberAccountNote" ADD CONSTRAINT "SubscriberAccountNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "Center_subscriberAccountId_idx" ON "Center"("subscriberAccountId");

-- Data: everything that exists today belongs to Ameris Academy, account
-- C-1001, with every add-on and room for 50 centers, so nothing changes for
-- current users. The Global admin can change these later.
INSERT INTO "SubscriberAccount" ("id", "accountNumber", "name", "status", "addOns", "maxCenters", "activatedAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text)::uuid::text, 'C-1001', 'Ameris Academy', 'ACTIVE',
       ARRAY['STEPS_OF_PROGRESSION','CURRICULUM','TEACHER_TRAINING','STAFF_MANAGEMENT'],
       GREATEST((SELECT COUNT(*) FROM "Center")::int, 50), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Center");

UPDATE "Center" SET "subscriberAccountId" = (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001');
UPDATE "User" SET "subscriberAccountId" = (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001');
