-- AlterTable
ALTER TABLE "SubscriberAccount" ADD COLUMN     "pricingSelection" JSONB;

-- CreateTable
CREATE TABLE "PricingSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingSet_effectiveDate_idx" ON "PricingSet"("effectiveDate");


-- The first pricing set: the sheet from the client's mockup (2026-11-10).
-- The mockup's 200–300 range overlapped 151–200, so it starts at 201.
INSERT INTO "PricingSet" ("id", "name", "effectiveDate", "data", "updatedAt")
VALUES ('pricing-set-2026-11', 'November 2026', DATE '2026-11-01', '{"baseRanges":[{"from":1,"to":10,"price":24.9},{"from":11,"to":20,"price":17.45},{"from":21,"to":30,"price":14.97},{"from":31,"to":50,"price":11.98},{"from":51,"to":100,"price":9.99},{"from":101,"to":150,"price":9.33},{"from":151,"to":200,"price":8.5},{"from":201,"to":300,"price":7.66},{"from":301,"to":400,"price":6.6},{"from":401,"to":500,"price":6.6},{"from":501,"to":600,"price":6.33}],"addOns":{"STEPS_OF_PROGRESSION":1.35,"TEACHER_TRAINING":1.25,"STAFF_MANAGEMENT":1},"curriculumCenters":[{"key":"infants","label":"Infants","standard":79,"faithBased":79},{"key":"toddlers","label":"Toddlers","standard":79,"faithBased":79},{"key":"2-years","label":"2 Years","standard":79,"faithBased":79},{"key":"3-years","label":"3 Years","standard":89,"faithBased":89},{"key":"4-years","label":"4 Years","standard":89,"faithBased":89},{"key":"5-years","label":"5 Years","standard":89,"faithBased":89},{"key":"6-12-years","label":"6 – 12 Years","standard":99,"faithBased":99}],"homeDaycare":[{"key":"early-learning","label":"Early Learning (Ages 0 – 5)","standard":49,"faithBased":49},{"key":"school-age","label":"School Age (Ages 6 – 12)","standard":59,"faithBased":59},{"key":"combined","label":"Combined (Ages 0 – 12)","standard":69,"faithBased":69}],"discounts":[{"id":"dccs","name":"DCCS","type":"PERCENT","amount":50,"appliesTo":"ALL","active":true},{"id":"conference","name":"Conference","type":"PERCENT","amount":25,"appliesTo":"ALL","active":true},{"id":"yearly","name":"Yearly (Annual)","type":"PERCENT","amount":15,"appliesTo":"ALL","active":true},{"id":"seasonal","name":"Seasonal","type":"PERCENT","amount":15,"appliesTo":"ALL","active":true}]}'::jsonb, CURRENT_TIMESTAMP);
