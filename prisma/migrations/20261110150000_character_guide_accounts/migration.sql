-- DropIndex
DROP INDEX "CharacterCategory_name_key";

-- AlterTable
ALTER TABLE "CharacterBehavior" ADD COLUMN     "importedFromId" TEXT,
ADD COLUMN     "subscriberAccountId" TEXT;

-- AlterTable
ALTER TABLE "CharacterCategory" ADD COLUMN     "subscriberAccountId" TEXT;

-- CreateIndex
CREATE INDEX "CharacterBehavior_subscriberAccountId_idx" ON "CharacterBehavior"("subscriberAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCategory_subscriberAccountId_name_key" ON "CharacterCategory"("subscriberAccountId", "name");

-- AddForeignKey
ALTER TABLE "CharacterCategory" ADD CONSTRAINT "CharacterCategory_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterBehavior" ADD CONSTRAINT "CharacterBehavior_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "SubscriberAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The guide built so far is the Ameris Character Guide: it belongs to the
-- account that owns the curriculum center (else C-1001).
UPDATE "CharacterCategory" SET "subscriberAccountId" = COALESCE(
  (SELECT "subscriberAccountId" FROM "Center" WHERE "curriculumSource" = true LIMIT 1),
  (SELECT "id" FROM "SubscriberAccount" WHERE "accountNumber" = 'C-1001')
) WHERE "subscriberAccountId" IS NULL;
UPDATE "CharacterBehavior" b SET "subscriberAccountId" = c."subscriberAccountId"
FROM "CharacterCategory" c WHERE c."id" = b."categoryId" AND b."subscriberAccountId" IS NULL;
