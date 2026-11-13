-- Several sign-ins/outs a day (client sheet 10-29 (8), rows 15/16).
-- CreateTable
CREATE TABLE "StaffAttendanceSession" (
    "id" TEXT NOT NULL,
    "staffAttendanceId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "clockInBy" TEXT,
    "clockOutBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL,
    "checkedOutAt" TIMESTAMP(3),
    "checkInBy" TEXT,
    "checkOutBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_staffAttendanceId_clockIn_idx" ON "StaffAttendanceSession"("staffAttendanceId", "clockIn");

-- CreateIndex
CREATE INDEX "AttendanceSession_attendanceId_checkedInAt_idx" ON "AttendanceSession"("attendanceId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_staffAttendanceId_fkey" FOREIGN KEY ("staffAttendanceId") REFERENCES "StaffAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Each existing day becomes its first session (its in and out times).
INSERT INTO "AttendanceSession" ("id", "attendanceId", "checkedInAt", "checkedOutAt", "checkInBy", "checkOutBy", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || a."id")::uuid::text, a."id", a."checkedInAt", a."checkedOutAt", a."checkInBy", a."checkOutBy", NOW(), NOW()
FROM "Attendance" a
WHERE a."checkedInAt" IS NOT NULL;

INSERT INTO "StaffAttendanceSession" ("id", "staffAttendanceId", "clockIn", "clockOut", "clockInBy", "clockOutBy", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || s."id")::uuid::text, s."id", s."clockIn", s."clockOut", s."clockInBy", s."clockOutBy", NOW(), NOW()
FROM "StaffAttendance" s
WHERE s."clockIn" IS NOT NULL;
