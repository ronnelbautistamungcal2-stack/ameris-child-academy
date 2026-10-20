-- CreateTable
CREATE TABLE "LessonCalendarAnchor" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonCalendarAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonClosedDay" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonClosedDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlanner" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "theme" TEXT,
    "dayCount" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlanCell" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlanCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonUsedMark" (
    "id" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonUsedMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonCalendarAnchor_centerId_idx" ON "LessonCalendarAnchor"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCalendarAnchor_classRoomId_startDate_key" ON "LessonCalendarAnchor"("classRoomId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "LessonClosedDay_centerId_date_key" ON "LessonClosedDay"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanner_classRoomId_key" ON "LessonPlanner"("classRoomId");

-- CreateIndex
CREATE INDEX "LessonPlanCell_lessonId_idx" ON "LessonPlanCell"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanCell_classRoomId_day_rowIndex_key" ON "LessonPlanCell"("classRoomId", "day", "rowIndex");

-- CreateIndex
CREATE INDEX "LessonUsedMark_lessonId_idx" ON "LessonUsedMark"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonUsedMark_classRoomId_lessonId_key" ON "LessonUsedMark"("classRoomId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonCalendarAnchor" ADD CONSTRAINT "LessonCalendarAnchor_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCalendarAnchor" ADD CONSTRAINT "LessonCalendarAnchor_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonClosedDay" ADD CONSTRAINT "LessonClosedDay_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanner" ADD CONSTRAINT "LessonPlanner_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanner" ADD CONSTRAINT "LessonPlanner_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanCell" ADD CONSTRAINT "LessonPlanCell_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanCell" ADD CONSTRAINT "LessonPlanCell_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanCell" ADD CONSTRAINT "LessonPlanCell_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonUsedMark" ADD CONSTRAINT "LessonUsedMark_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonUsedMark" ADD CONSTRAINT "LessonUsedMark_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

