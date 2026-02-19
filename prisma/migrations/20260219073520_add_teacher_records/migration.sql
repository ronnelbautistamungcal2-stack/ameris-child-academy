-- CreateEnum
CREATE TYPE "TeacherRecordType" AS ENUM ('CERTIFICATE', 'ACHIEVEMENT', 'EMPLOYEE_OF_THE_MONTH', 'CAREER_LADDER');

-- CreateTable
CREATE TABLE "TeacherRecord" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "TeacherRecordType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherRecord_teacherId_type_idx" ON "TeacherRecord"("teacherId", "type");

-- CreateIndex
CREATE INDEX "TeacherRecord_teacherId_date_idx" ON "TeacherRecord"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherRecord_createdById_idx" ON "TeacherRecord"("createdById");

-- AddForeignKey
ALTER TABLE "TeacherRecord" ADD CONSTRAINT "TeacherRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherRecord" ADD CONSTRAINT "TeacherRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
