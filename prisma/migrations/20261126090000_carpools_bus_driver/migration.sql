-- Carpools set up on each center, and the Bus Driver role (client sheet 10-29 (11), rows 5-8).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUS_DRIVER';
ALTER TABLE "Center" ADD COLUMN "carpools" JSONB;
