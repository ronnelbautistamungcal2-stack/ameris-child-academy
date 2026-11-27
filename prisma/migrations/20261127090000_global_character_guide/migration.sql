-- The Global Character Guide (client sheet 10-29 (11), row 66): edited by
-- Global admins; every account copies from it.
ALTER TABLE "CharacterCategory" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CharacterBehavior" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "CharacterBehavior_isGlobal_idx" ON "CharacterBehavior"("isGlobal");
