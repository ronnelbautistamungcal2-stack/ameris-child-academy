/*
  Warnings:

  - You are about to drop the column `data` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `recordedAt` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `classroomId` on the `Child` table. All the data in the column will be lost.
  - You are about to drop the column `dob` on the `Child` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `mediaUrl` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Progress` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Progress` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `Classroom` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CenterUsers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[centerId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Made the column `centerId` on table `Lesson` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lessonId` on table `Progress` required. This step will fail if there are existing NULL values in that column.
  - Made the column `centerId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Child" DROP CONSTRAINT "Child_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_centerId_fkey";

-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_centerId_fkey";

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_centerId_fkey";

-- DropForeignKey
ALTER TABLE "_CenterUsers" DROP CONSTRAINT "_CenterUsers_A_fkey";

-- DropForeignKey
ALTER TABLE "_CenterUsers" DROP CONSTRAINT "_CenterUsers_B_fkey";

-- AlterTable
ALTER TABLE "ActivityLog" DROP COLUMN "data",
DROP COLUMN "recordedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "Child" DROP COLUMN "classroomId",
DROP COLUMN "dob",
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "classRoomId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "lastName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "createdAt",
DROP COLUMN "mediaUrl",
ADD COLUMN     "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "centerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Progress" DROP COLUMN "createdAt",
DROP COLUMN "notes",
ADD COLUMN     "achievedAt" TIMESTAMP(3),
ALTER COLUMN "lessonId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "startedAt",
ADD COLUMN     "paymentInfo" JSONB,
ALTER COLUMN "centerId" SET NOT NULL;

-- DropTable
DROP TABLE "Classroom";

-- DropTable
DROP TABLE "_CenterUsers";

-- CreateTable
CREATE TABLE "CenterUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "CenterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherClass" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "TeacherClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CenterUser_userId_centerId_key" ON "CenterUser"("userId", "centerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherClass_teacherId_classId_key" ON "TeacherClass"("teacherId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_centerId_key" ON "Subscription"("centerId");

-- AddForeignKey
ALTER TABLE "CenterUser" ADD CONSTRAINT "CenterUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterUser" ADD CONSTRAINT "CenterUser_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClass" ADD CONSTRAINT "TeacherClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClass" ADD CONSTRAINT "TeacherClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
