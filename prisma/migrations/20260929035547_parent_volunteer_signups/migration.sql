-- AlterTable
ALTER TABLE "ParentInvolvement" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "hours" DOUBLE PRECISION,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'LOG';

-- AlterTable
ALTER TABLE "ParentInvolvementActivity" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "_ParentInvolvementChildren" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ParentInvolvementChildren_AB_unique" ON "_ParentInvolvementChildren"("A", "B");

-- CreateIndex
CREATE INDEX "_ParentInvolvementChildren_B_index" ON "_ParentInvolvementChildren"("B");

-- AddForeignKey
ALTER TABLE "_ParentInvolvementChildren" ADD CONSTRAINT "_ParentInvolvementChildren_A_fkey" FOREIGN KEY ("A") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParentInvolvementChildren" ADD CONSTRAINT "_ParentInvolvementChildren_B_fkey" FOREIGN KEY ("B") REFERENCES "ParentInvolvement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry single-child records over to the multi-child relation
INSERT INTO "_ParentInvolvementChildren" ("A", "B")
SELECT "childId", "id" FROM "ParentInvolvement" WHERE "childId" IS NOT NULL
ON CONFLICT DO NOTHING;
