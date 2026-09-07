-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffDepartment" TEXT;

-- AlterTable
ALTER TABLE "PolicyDocument" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'POLICY';
