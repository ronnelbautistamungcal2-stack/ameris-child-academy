ALTER TABLE "TimeOffRequest" ADD COLUMN "requestGroupId" TEXT;

CREATE INDEX "TimeOffRequest_requestGroupId_idx" ON "TimeOffRequest"("requestGroupId");
