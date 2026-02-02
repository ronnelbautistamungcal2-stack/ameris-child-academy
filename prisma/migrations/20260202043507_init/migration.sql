-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'PARENT', 'COACH', 'SUBSCRIBER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT,
    "centerId" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "centerId" TEXT NOT NULL,
    "classroomId" TEXT,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "centerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "lessonId" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "tier" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CenterUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_CenterUsers_AB_unique" ON "_CenterUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_CenterUsers_B_index" ON "_CenterUsers"("B");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CenterUsers" ADD CONSTRAINT "_CenterUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CenterUsers" ADD CONSTRAINT "_CenterUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
