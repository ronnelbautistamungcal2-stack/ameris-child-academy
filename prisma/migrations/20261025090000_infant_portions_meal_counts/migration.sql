-- CreateTable
CREATE TABLE "InfantPortion" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfantPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealProductionCount" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "planned" INTEGER NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealProductionCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfantPortion_childId_date_idx" ON "InfantPortion"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InfantPortion_centerId_date_meal_childId_component_key" ON "InfantPortion"("centerId", "date", "meal", "childId", "component");

-- CreateIndex
CREATE UNIQUE INDEX "MealProductionCount_centerId_date_meal_ageGroup_key" ON "MealProductionCount"("centerId", "date", "meal", "ageGroup");

-- AddForeignKey
ALTER TABLE "InfantPortion" ADD CONSTRAINT "InfantPortion_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfantPortion" ADD CONSTRAINT "InfantPortion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealProductionCount" ADD CONSTRAINT "MealProductionCount_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

