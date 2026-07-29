-- CreateTable
CREATE TABLE "EvaluationCategoryConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCategoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionPolicyConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT,
    "permissionType" "PermissionType" NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "policySummary" TEXT,
    "policySections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policyDocumentId" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionPolicyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCategoryConfig_centerId_key" ON "EvaluationCategoryConfig"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionPolicyConfig_centerId_permissionType_key" ON "PermissionPolicyConfig"("centerId", "permissionType");

-- AddForeignKey
ALTER TABLE "EvaluationCategoryConfig" ADD CONSTRAINT "EvaluationCategoryConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionPolicyConfig" ADD CONSTRAINT "PermissionPolicyConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionPolicyConfig" ADD CONSTRAINT "PermissionPolicyConfig_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionPolicyConfig" ADD CONSTRAINT "PermissionPolicyConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
