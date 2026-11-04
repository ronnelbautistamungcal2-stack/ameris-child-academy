-- Create Checklist: a Role field; the checklist shows only for those roles.
ALTER TABLE "DailyChecklist" ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
