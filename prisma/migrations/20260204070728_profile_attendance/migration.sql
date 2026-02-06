-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aboutMe" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "pictureUrl" TEXT;

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "centerId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_centerId_day_idx" ON "Attendance"("centerId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_childId_day_key" ON "Attendance"("childId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CenterInvite_code_key" ON "CenterInvite"("code");

-- CreateIndex
CREATE INDEX "CenterInvite_centerId_idx" ON "CenterInvite"("centerId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInvite" ADD CONSTRAINT "CenterInvite_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInvite" ADD CONSTRAINT "CenterInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
