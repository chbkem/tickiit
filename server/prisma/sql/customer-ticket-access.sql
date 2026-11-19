-- Additive schema changes for customer ticket access links (spec 0004).
--
-- This file is applied with `prisma db execute --file ...` instead of
-- `prisma db push` on purpose. The live database currently carries columns and
-- a table that are not present in schema.prisma (Ticket.isSpam,
-- Ticket.quarantinedAt, Ticket.spamReasons, Ticket.spamScore and
-- FormSubmissionAttempt). A full db push would drop them. This script only
-- adds the objects this feature needs and is safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommentVisibility') THEN
    CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'CUSTOMER');
  END IF;
END $$;

ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "visibility" "CommentVisibility" NOT NULL DEFAULT 'PUBLIC';

CREATE TABLE IF NOT EXISTS "TicketAccessToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "TicketAccessToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketAccessToken_tokenHash_key" UNIQUE ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "TicketAccessToken_ticketId_expiresAt_idx"
  ON "TicketAccessToken"("ticketId", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TicketAccessToken_ticketId_fkey'
  ) THEN
    ALTER TABLE "TicketAccessToken"
      ADD CONSTRAINT "TicketAccessToken_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
