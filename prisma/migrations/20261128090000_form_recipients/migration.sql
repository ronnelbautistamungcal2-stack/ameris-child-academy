-- Who a parent form goes to (client sheet 10-29 (12), row 19):
-- { "parentIds": [...], "childIds": [...] }; null = every family.
ALTER TABLE "FormTemplate" ADD COLUMN "recipients" JSONB;
