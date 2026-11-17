-- Import again brings in Ameris changes to behaviors already imported (client 2026-11-11).
ALTER TABLE "CharacterBehavior" ADD COLUMN "importedAt" TIMESTAMP(3);

-- Copies made before now were taken when they were created.
UPDATE "CharacterBehavior" SET "importedAt" = "createdAt" WHERE "importedFromId" IS NOT NULL;
