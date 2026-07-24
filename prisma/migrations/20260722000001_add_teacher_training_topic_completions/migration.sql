CREATE TABLE "TeacherTrainingTopicCompletion" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherTrainingTopicCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherTrainingTopicCompletion_topicId_teacherId_key"
ON "TeacherTrainingTopicCompletion"("topicId", "teacherId");

CREATE INDEX "TeacherTrainingTopicCompletion_teacherId_idx"
ON "TeacherTrainingTopicCompletion"("teacherId");

ALTER TABLE "TeacherTrainingTopicCompletion"
ADD CONSTRAINT "TeacherTrainingTopicCompletion_topicId_fkey"
FOREIGN KEY ("topicId") REFERENCES "TeacherTrainingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherTrainingTopicCompletion"
ADD CONSTRAINT "TeacherTrainingTopicCompletion_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
