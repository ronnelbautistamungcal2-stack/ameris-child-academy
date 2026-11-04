-- Calendar events can apply to some roles only (client request 2026-10-29).
ALTER TABLE "Event" ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
