/*
  Warnings:

  - You are about to drop the column `targetDomains` on the `BehaviorPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BehaviorPlan" DROP COLUMN "targetDomains";

-- AlterTable
ALTER TABLE "EvaluationCategoryConfig" ALTER COLUMN "categories" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PermissionPolicyConfig" ALTER COLUMN "policySections" DROP DEFAULT;
