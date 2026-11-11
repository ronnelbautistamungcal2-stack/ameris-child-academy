-- Complete Your Enrollment with Stripe Checkout.
ALTER TABLE "Lead" ADD COLUMN "enrollment" JSONB;

ALTER TABLE "SubscriberAccount" ADD COLUMN "billingCycle" TEXT,
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripeCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX "SubscriberAccount_stripeCheckoutSessionId_key" ON "SubscriberAccount"("stripeCheckoutSessionId");
