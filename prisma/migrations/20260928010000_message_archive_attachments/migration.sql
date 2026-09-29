-- AlterTable
ALTER TABLE "ThreadParticipant" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentSize" INTEGER,
ADD COLUMN "attachmentType" TEXT;
