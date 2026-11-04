-- Add Charge: Charge Type (Tuition, Supplies, Other).
ALTER TABLE "BillingCharge" ADD COLUMN "chargeType" TEXT NOT NULL DEFAULT 'OTHER';
