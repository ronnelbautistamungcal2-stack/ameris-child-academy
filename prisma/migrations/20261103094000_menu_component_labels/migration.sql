-- Admins can rename menu component titles per center.
ALTER TABLE "Center" ADD COLUMN "menuComponentLabels" JSONB;
