-- Student List > Enrollment Status history (client sheet 2026-11-07).
-- CreateTable
CREATE TABLE "ChildEnrollmentStatusEntry" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildEnrollmentStatusEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildEnrollmentStatusEntry_childId_date_idx" ON "ChildEnrollmentStatusEntry"("childId", "date");

-- AddForeignKey
ALTER TABLE "ChildEnrollmentStatusEntry" ADD CONSTRAINT "ChildEnrollmentStatusEntry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

