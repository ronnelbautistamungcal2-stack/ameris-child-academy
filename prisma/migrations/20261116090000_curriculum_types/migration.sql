-- Curriculum types become a list the Ameris admins edit (client sheet 10-29 (8), rows 8-10).
CREATE TABLE "CurriculumType" (
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurriculumType_pkey" PRIMARY KEY ("value")
);

-- The three types that were fixed in the code until now.
INSERT INTO "CurriculumType" ("value", "label", "sortOrder") VALUES
    ('NON_DENOMINATIONAL', 'Non-Denominational', 1),
    ('NON_DENOMINATIONAL_CHRISTIAN', 'Non-Denominational Christian', 2),
    ('OTHER', 'Other', 3);
