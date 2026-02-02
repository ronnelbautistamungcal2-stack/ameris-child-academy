/*
  Warnings:

  - The `type` column on the `ActivityLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[childId,lessonId,goalIndex]` on the table `Progress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Progress` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('DIAPER_CHANGE', 'NAP', 'BOTTLE', 'MEAL', 'SNACK', 'ACTIVITY', 'TASK_CHECKLIST', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "isBackdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "ActivityType" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Progress" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "goalIndex" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "previousGoalId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "TaskChecklist" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "centerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "policyLink" TEXT,
    "mediaLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildTask" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ChildTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildTask_childId_taskId_key" ON "ChildTask"("childId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_childId_lessonId_goalIndex_key" ON "Progress"("childId", "lessonId", "goalIndex");

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_previousGoalId_fkey" FOREIGN KEY ("previousGoalId") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklist" ADD CONSTRAINT "TaskChecklist_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "TaskChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildTask" ADD CONSTRAINT "ChildTask_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildTask" ADD CONSTRAINT "ChildTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
