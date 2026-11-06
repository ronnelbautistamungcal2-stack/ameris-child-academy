-- Policies, form templates and parent FAQs with no center used to mean "every
-- center". With more than one subscriber account they need an owner, so a
-- shared document reaches only the centers of its own account.

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "subscriberAccountId" TEXT;

-- AlterTable
ALTER TABLE "ParentFaq" ADD COLUMN     "subscriberAccountId" TEXT;

-- AlterTable
ALTER TABLE "PolicyDocument" ADD COLUMN     "subscriberAccountId" TEXT;

-- CreateIndex
CREATE INDEX "FormTemplate_subscriberAccountId_idx" ON "FormTemplate"("subscriberAccountId");

-- CreateIndex
CREATE INDEX "ParentFaq_subscriberAccountId_idx" ON "ParentFaq"("subscriberAccountId");

-- CreateIndex
CREATE INDEX "PolicyDocument_subscriberAccountId_idx" ON "PolicyDocument"("subscriberAccountId");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFaq" ADD CONSTRAINT "ParentFaq_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: a document belongs to its center's account; one with no center
-- belongs to Ameris Academy (C-1001), which owned everything before accounts.
UPDATE "FormTemplate" t SET "subscriberAccountId" = COALESCE(
  (SELECT c."subscriberAccountId" FROM "Center" c WHERE c."id" = t."centerId"),
  (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001'));

UPDATE "PolicyDocument" d SET "subscriberAccountId" = COALESCE(
  (SELECT c."subscriberAccountId" FROM "Center" c WHERE c."id" = d."centerId"),
  (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001'));

UPDATE "ParentFaq" f SET "subscriberAccountId" = COALESCE(
  (SELECT c."subscriberAccountId" FROM "Center" c WHERE c."id" = f."centerId"),
  (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001'));
