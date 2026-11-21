-- A staff member or parent who is also an authorized pickup (client 2026-11-21):
-- the pickup person links to their user, so their own kiosk PIN shows those
-- children next to the time clock.
ALTER TABLE "PickupPerson" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "PickupPerson_userId_idx" ON "PickupPerson"("userId");

-- AddForeignKey
ALTER TABLE "PickupPerson" ADD CONSTRAINT "PickupPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
