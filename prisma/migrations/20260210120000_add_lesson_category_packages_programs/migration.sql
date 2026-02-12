-- AlterTable
ALTER TABLE "LessonCategory"
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'PACKAGE',
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "ageRange" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "videoUrl" TEXT;

