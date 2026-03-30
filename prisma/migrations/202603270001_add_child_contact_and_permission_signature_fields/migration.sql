ALTER TABLE "Child"
ADD COLUMN "emergencyContacts" JSONB,
ADD COLUMN "parentContacts" JSONB;

ALTER TABLE "ChildPermission"
ADD COLUMN "signatureName" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3);
