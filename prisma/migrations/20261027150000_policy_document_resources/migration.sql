-- AlterTable
ALTER TABLE "PolicyDocument" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "showOnHomePage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

