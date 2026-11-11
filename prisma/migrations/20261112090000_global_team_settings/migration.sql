-- AlterTable
ALTER TABLE "User" ADD COLUMN     "globalPermissions" JSONB,
ADD COLUMN     "globalTeamRole" TEXT;

-- CreateTable
CREATE TABLE "GlobalSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");


-- Starting email templates (client mockup: Settings > Email Templates).
INSERT INTO "EmailTemplate" ("id", "key", "name", "subject", "body", "active", "updatedAt") VALUES
('email-quote', 'QUOTE', 'Quote Email', 'Thank you for your interest in Ameris Solutions',
 E'Hello,\n\nThank you for your interest in Ameris Solutions! We are excited to help you find the right solution for your childcare program.\n\nOur team will review your request and be in touch with you soon to discuss your needs and provide a customized quote. If you have any immediate questions, feel free to reach out to us at (801) 555-1234 or reply to this email.\n\nThank you again for considering Ameris Solutions!\n\nBest regards,\nAmeris Solutions Team\nwww.amerissolutions.com', true, CURRENT_TIMESTAMP),
('email-invoice', 'INVOICE', 'Invoice Email', 'Your Ameris Solutions invoice',
 E'Hello,\n\nYour Ameris Solutions invoice is ready. Thank you for being part of the Ameris Solutions family!\n\nBest regards,\nAmeris Solutions Team', true, CURRENT_TIMESTAMP),
('email-receipt', 'PAYMENT_RECEIPT', 'Payment Receipt', 'Payment received - thank you',
 E'Hello,\n\nWe received your payment. Thank you!\n\nBest regards,\nAmeris Solutions Team', true, CURRENT_TIMESTAMP),
('email-agreement', 'AGREEMENT', 'Agreement Email', 'Please review and sign your Ameris Solutions agreement',
 E'Hello,\n\nPlease review and sign your Ameris Solutions Subscriber Agreement to complete your enrollment.\n\nBest regards,\nAmeris Solutions Team', true, CURRENT_TIMESTAMP),
('email-welcome', 'WELCOME', 'Welcome Email', 'Welcome to Ameris Solutions!',
 E'Hello,\n\nWelcome to Ameris Solutions! Your account is ready. Sign in to get started, and our team will help you set everything up.\n\nBest regards,\nAmeris Solutions Team', true, CURRENT_TIMESTAMP),
('email-renewal', 'RENEWAL_REMINDER', 'Renewal Reminder', 'Your Ameris Solutions subscription renews soon',
 E'Hello,\n\nThis is a reminder that your Ameris Solutions subscription renews soon. No action is needed to keep your service running. If you have questions about your plan, contact us any time.\n\nBest regards,\nAmeris Solutions Team', true, CURRENT_TIMESTAMP);
