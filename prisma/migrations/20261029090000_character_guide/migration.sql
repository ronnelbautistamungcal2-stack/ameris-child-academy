-- CreateTable
CREATE TABLE "CharacterCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterBehavior" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "tree" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterBehavior_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCategory_name_key" ON "CharacterCategory"("name");

-- CreateIndex
CREATE INDEX "CharacterBehavior_categoryId_idx" ON "CharacterBehavior"("categoryId");

-- CreateIndex
CREATE INDEX "CharacterBehavior_type_idx" ON "CharacterBehavior"("type");

-- AddForeignKey
ALTER TABLE "CharacterBehavior" ADD CONSTRAINT "CharacterBehavior_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CharacterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Starter content from the client's mockups (40-01, 40-02, 40-11).
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Physical Aggression', 'Behaviors that involve physical harm, hitting, kicking, biting, pushing, or unsafe actions toward others.', 0, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Verbal Aggression', 'Behaviors that include mean, threatening, or hurtful comments.', 1, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Respect', 'Behaviors that show kindness, consideration, and appropriate communication with others.', 2, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Safety', 'Behaviors that keep self and others safe.', 3, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Responsibility', 'Behaviors that show ownership, follow directions, and complete tasks.', 4, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Honesty', 'Behaviors that show truthfulness and trustworthiness.', 5, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Self-Control', 'Behaviors that show appropriate management of emotions and impulses.', 6, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Kindness', 'Behaviors that show caring, helpful, and friendly actions toward others.', 7, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Cooperation', 'Behaviors that show willingness to work and play together.', 8, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Listening', 'Behaviors that show attention and follow spoken instructions.', 9, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Following Directions', 'Behaviors that show compliance with adult requests.', 10, CURRENT_TIMESTAMP);
INSERT INTO "CharacterCategory" ("id", "name", "description", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'Problem Solving', 'Behaviors that show effort to find safe and positive solutions.', 11, CURRENT_TIMESTAMP);
INSERT INTO "CharacterBehavior" ("id", "categoryId", "name", "type", "level", "description", "tree", "updatedAt") SELECT gen_random_uuid()::text, "id", 'Child Hits Another Child', 'COURSE_CORRECTION', 1, 'Child is unable to express a need or feeling and hits another child as a result.', '{"intro": "Stay calm. Ensure all children are safe.", "question": {"title": "Step 1: Determine the Reason", "prompt": "What best explains why the child hit?"}, "branches": [{"id": "b1", "title": "Seeking Attention", "prompt": "Was the child trying to get attention from an adult or peer?", "offenses": [{"id": "o1", "steps": ["Acknowledge safely.", "Redirect to positive behavior.", "Reinforce appropriate choices."]}, {"id": "o2", "steps": ["Provide a brief break.", "Loss of preferred activity (5 minutes).", "Practice appropriate words."]}]}, {"id": "b2", "title": "Frustration", "prompt": "Was the child unable to express a need or feeling?", "offenses": [{"id": "o1", "steps": ["Help the child identify their feeling.", "Teach and model appropriate words.", "Offer a solution or alternative."]}]}, {"id": "b3", "title": "Conflict Over Item", "prompt": "Was the child trying to get a toy or space from another child?", "offenses": [{"id": "o1", "steps": ["Ensure both children are safe.", "Acknowledge each child''s feelings.", "Teach problem-solving skills."]}, {"id": "o2", "steps": ["Separate the children.", "Loss of preferred item (5 minutes).", "Practice sharing and turn-taking."]}, {"id": "o3", "steps": ["Time out with teacher.", "Loss of preferred activity (10 minutes).", "Parent/guardian notification."]}]}, {"id": "b4", "title": "Sensory/Overstimulated", "prompt": "Was the child feeling overwhelmed or overstimulated?", "offenses": [{"id": "o1", "steps": ["Reduce stimulation.", "Offer a calm space or break.", "Use calming tools or strategies."]}]}]}'::jsonb, CURRENT_TIMESTAMP FROM "CharacterCategory" WHERE "name" = 'Physical Aggression';
INSERT INTO "CharacterBehavior" ("id", "categoryId", "name", "type", "level", "description", "tree", "updatedAt") SELECT gen_random_uuid()::text, "id", 'Told the Truth', 'CHARACTER_HIGHLIGHT', 1, 'Child honestly told the teacher when a mistake happened.', '{"intro": "Honest choices build trust and strong relationships.", "question": {"title": "Step 1: What Positive Behavior Did the Child Show?", "prompt": "Describe what the child did."}, "branches": [{"id": "b1", "title": "Honesty", "prompt": "Did the child tell the truth or admit a mistake?", "praisePrompt": "How will you recognize the child?", "rewards": ["Verbal praise", "Classroom privilege", "Sticker or point", "Special helper job", "Note or message home"]}, {"id": "b2", "title": "Kindness", "prompt": "Did the child show kindness to a peer or adult?", "praisePrompt": "How will you recognize the child?", "rewards": ["Verbal praise", "Classroom privilege", "Sticker or point", "Positive note home", "Choose a class activity"]}, {"id": "b3", "title": "Responsibility", "prompt": "Did the child take ownership, follow directions, or complete a task?", "praisePrompt": "How will you recognize the child?", "rewards": ["Verbal praise", "Extra play time", "Special helper job", "Positive note home", "Certificate"]}, {"id": "b4", "title": "Respect", "prompt": "Did the child show respect to peers, teachers, or property?", "praisePrompt": "How will you recognize the child?", "rewards": ["Verbal praise", "Classroom privilege", "Sticker or point", "Positive note home", "Sit by a friend"]}]}'::jsonb, CURRENT_TIMESTAMP FROM "CharacterCategory" WHERE "name" = 'Honesty';
