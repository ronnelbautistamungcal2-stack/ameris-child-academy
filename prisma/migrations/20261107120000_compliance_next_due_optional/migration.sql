-- The Next Due Date of a compliance requirement is optional (client sheet 2026-11-07).
ALTER TABLE "ComplianceRequirement" ALTER COLUMN "nextDue" DROP NOT NULL;
