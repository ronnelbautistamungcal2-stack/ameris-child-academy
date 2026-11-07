-- Checklist Review: a coach or admin can mark an item Excused (client sheet 2026-11-07).
ALTER TABLE "DailyChecklistCompletion" ADD COLUMN "excused" BOOLEAN NOT NULL DEFAULT false;
