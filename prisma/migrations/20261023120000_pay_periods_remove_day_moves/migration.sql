-- DropForeignKey
ALTER TABLE "StaffDayMove" DROP CONSTRAINT "StaffDayMove_userId_fkey";

-- DropForeignKey
ALTER TABLE "StaffDayMove" DROP CONSTRAINT "StaffDayMove_centerId_fkey";

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "payPeriodSettings" JSONB;

-- DropTable
DROP TABLE "StaffDayMove";

