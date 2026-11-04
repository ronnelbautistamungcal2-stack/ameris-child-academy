-- Checking a compliance requirement off keeps it and adds a row for the next due date.
ALTER TABLE "ComplianceRequirement" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "previousId" TEXT;
