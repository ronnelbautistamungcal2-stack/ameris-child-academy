-- AlterTable
ALTER TABLE "ParentInvolvementActivity" ADD COLUMN     "audience" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
ADD COLUMN     "classRoomIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "roles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "ParentInvolvement" ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "roleName" TEXT,
ADD COLUMN     "signature" JSONB;

