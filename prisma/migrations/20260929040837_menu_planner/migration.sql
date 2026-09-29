-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_date_idx" ON "MenuItem"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_date_meal_ageGroup_component_key" ON "MenuItem"("date", "meal", "ageGroup", "component");
