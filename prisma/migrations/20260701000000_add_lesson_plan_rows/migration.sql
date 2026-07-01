-- CreateTable
CREATE TABLE "LessonPlanRow" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlanRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanRow_classRoomId_rowIndex_key" ON "LessonPlanRow"("classRoomId", "rowIndex");

-- CreateIndex
CREATE INDEX "LessonPlanRow_centerId_classRoomId_idx" ON "LessonPlanRow"("centerId", "classRoomId");

-- AddForeignKey
ALTER TABLE "LessonPlanRow" ADD CONSTRAINT "LessonPlanRow_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlanRow" ADD CONSTRAINT "LessonPlanRow_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
