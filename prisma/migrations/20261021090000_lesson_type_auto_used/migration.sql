-- DropForeignKey
ALTER TABLE "LessonUsedMark" DROP CONSTRAINT "LessonUsedMark_classRoomId_fkey";

-- DropForeignKey
ALTER TABLE "LessonUsedMark" DROP CONSTRAINT "LessonUsedMark_lessonId_fkey";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "type" TEXT;

-- DropTable
DROP TABLE "LessonUsedMark";

