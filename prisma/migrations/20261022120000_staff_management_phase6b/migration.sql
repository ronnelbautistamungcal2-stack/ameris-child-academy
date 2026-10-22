-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employmentStatus" TEXT NOT NULL DEFAULT 'CURRENTLY_EMPLOYED';

-- CreateTable
CREATE TABLE "EmploymentStatusEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentStatusEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDayMove" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromClassRoomId" TEXT,
    "toClassRoomId" TEXT,
    "movedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDayMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSheetSignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "signatureName" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeSheetSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentStatusEntry_userId_date_idx" ON "EmploymentStatusEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "StaffDayMove_centerId_date_idx" ON "StaffDayMove"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDayMove_userId_date_key" ON "StaffDayMove"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSheetSignature_userId_from_to_key" ON "TimeSheetSignature"("userId", "from", "to");

-- AddForeignKey
ALTER TABLE "EmploymentStatusEntry" ADD CONSTRAINT "EmploymentStatusEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDayMove" ADD CONSTRAINT "StaffDayMove_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDayMove" ADD CONSTRAINT "StaffDayMove_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSheetSignature" ADD CONSTRAINT "TimeSheetSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

