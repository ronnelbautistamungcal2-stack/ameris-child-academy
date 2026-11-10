-- CreateTable
CREATE TABLE "TermsDocument" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TermsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriberAccountId" TEXT,
    "role" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermsDocument_kind_publishedAt_idx" ON "TermsDocument"("kind", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermsDocument_kind_version_key" ON "TermsDocument"("kind", "version");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_idx" ON "TermsAcceptance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptance_documentId_userId_key" ON "TermsAcceptance"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TermsDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The first End-User Terms of Use: Part 2 of the client's Ameris Solutions
-- Subscription Agreement (Google Drive > website development). Every staff
-- member and parent accepts it at their next login.
INSERT INTO "TermsDocument" ("id", "kind", "version", "title", "body", "publishedAt")
VALUES (
  'terms-end-user-2026-11-11',
  'END_USER',
  '2026-11-11',
  'End-User Terms of Use',
  'These Terms apply to you as an individual user of the Ameris Solutions software (the "Services"), provided by Kingston Laboratories LLC d/b/a Ameris Solutions. Your account is provided by the childcare provider, school, or other subscriber (your "Provider") that invited you. By logging in, you agree to these Terms.

1. Your account. Your account is personal to you. Keep your password private, do not share your login, and tell your Provider or us right away if you think someone else has used your account.

2. Who controls your information. Your Provider decides what information about children, families, and staff is collected and kept in the Services. Your Provider''s own policies and enrollment agreements govern that information. Ameris Solutions stores and processes it on your Provider''s behalf. Questions about records, corrections, or deletion should go to your Provider first.

3. Acceptable use. Use the Services only for their intended purpose with your Provider. Do not access information about children or families you are not authorized to see, share screenshots or records outside your Provider''s permitted uses, upload unlawful or harmful content, or try to interfere with the Services'' security.

4. Photos and messages. Photos, messages, and updates shared through the Services are for your Provider and the families it serves. Do not repost photos of children other than your own without the other family''s permission.

5. Not professional advice. Developmental milestones and assessments in the Services are educational tools, not medical or diagnostic evaluations. Talk with a qualified professional about any concern regarding your child''s development or health.

6. Ownership. The software and curriculum content belong to Ameris Solutions and its licensors. You may use them only through your Provider''s account.

7. Ending access. Your access ends if your Provider removes you or its subscription ends, or if you violate these Terms.

8. Disclaimer. The Services are provided "as is." To the extent permitted by law, Ameris Solutions is not liable to you for indirect or consequential damages arising from your use of the Services. Nothing in these Terms limits rights you have under law that cannot be waived.

9. Changes and contact. We may update these Terms and will show you the new version before it applies. Utah law governs these Terms. Contact: customerservice@amerissolutions.com.',
  CURRENT_TIMESTAMP
);
