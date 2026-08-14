-- CreateTable
CREATE TABLE "CoachTeamMember" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachTeamMember_staffId_idx" ON "CoachTeamMember"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachTeamMember_coachId_staffId_key" ON "CoachTeamMember"("coachId", "staffId");

-- AddForeignKey
ALTER TABLE "CoachTeamMember" ADD CONSTRAINT "CoachTeamMember_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTeamMember" ADD CONSTRAINT "CoachTeamMember_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
