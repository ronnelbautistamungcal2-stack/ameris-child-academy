-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "middleInitial" TEXT;

-- CreateTable
CREATE TABLE "PickupPerson" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleInitial" TEXT,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildPickupPerson" (
    "childId" TEXT NOT NULL,
    "pickupPersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildPickupPerson_pkey" PRIMARY KEY ("childId","pickupPersonId")
);

-- CreateTable
CREATE TABLE "KioskCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "pickupPersonId" TEXT,
    "pinLookup" TEXT,
    "pinCipher" TEXT,
    "pinSetAt" TIMESTAMP(3),
    "registrationLookup" TEXT,
    "registrationExpiresAt" TIMESTAMP(3),
    "registrationIssuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KioskCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupPerson_centerId_lastName_idx" ON "PickupPerson"("centerId", "lastName");

-- CreateIndex
CREATE INDEX "ChildPickupPerson_pickupPersonId_idx" ON "ChildPickupPerson"("pickupPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskCredential_userId_key" ON "KioskCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskCredential_pickupPersonId_key" ON "KioskCredential"("pickupPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskCredential_pinLookup_key" ON "KioskCredential"("pinLookup");

-- CreateIndex
CREATE UNIQUE INDEX "KioskCredential_registrationLookup_key" ON "KioskCredential"("registrationLookup");

-- AddForeignKey
ALTER TABLE "PickupPerson" ADD CONSTRAINT "PickupPerson_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildPickupPerson" ADD CONSTRAINT "ChildPickupPerson_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildPickupPerson" ADD CONSTRAINT "ChildPickupPerson_pickupPersonId_fkey" FOREIGN KEY ("pickupPersonId") REFERENCES "PickupPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskCredential" ADD CONSTRAINT "KioskCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskCredential" ADD CONSTRAINT "KioskCredential_pickupPersonId_fkey" FOREIGN KEY ("pickupPersonId") REFERENCES "PickupPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A credential belongs to exactly one user or one pickup person.
ALTER TABLE "KioskCredential" ADD CONSTRAINT "KioskCredential_one_owner_check"
  CHECK (("userId" IS NULL) <> ("pickupPersonId" IS NULL));
