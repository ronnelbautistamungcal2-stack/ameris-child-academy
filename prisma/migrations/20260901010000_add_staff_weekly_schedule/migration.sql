-- CreateTable
CREATE TABLE "StaffWeeklySchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWeeklySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftScheduleGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftScheduleGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffWeeklySchedule_userId_idx" ON "StaffWeeklySchedule"("userId");

-- CreateIndex
CREATE INDEX "ShiftScheduleGeneration_centerId_weekStart_idx" ON "ShiftScheduleGeneration"("centerId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftScheduleGeneration_userId_centerId_weekStart_key" ON "ShiftScheduleGeneration"("userId", "centerId", "weekStart");

-- AddForeignKey
ALTER TABLE "StaffWeeklySchedule" ADD CONSTRAINT "StaffWeeklySchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftScheduleGeneration" ADD CONSTRAINT "ShiftScheduleGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
