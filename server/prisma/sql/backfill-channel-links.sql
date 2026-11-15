-- backfill-channel-links.sql
-- Spec 0003 (bring your own Telegram bots), phase 2. Run after `prisma db push`:
--   npx prisma db execute --file prisma/sql/backfill-channel-links.sql
--
-- Both IngestionEvent.channelId and Ticket.channelId are null on every row
-- created under spec 0002. This fills them in where the link can be proven and
-- leaves it null everywhere else. Both columns stay nullable in this phase; the
-- tighten phase (make channelId required on IngestionEvent) is the step that
-- needs every Telegram row resolved.
--
-- How a row is resolved. Neither table stores a channel identifier, so the only
-- link available before this script runs is the ticket:
--     Ticket -> Channel  where the org has exactly one channel of that type
--     IngestionEvent -> its ticket -> the same rule
-- "Exactly one" is what makes the result provable rather than guessed. When an
-- organization runs two channels of the same type the choice is ambiguous, so
-- the row is left null and counted as unresolved rather than attached to the
-- wrong channel. Attach those by hand before the tighten phase.
--
-- Everything runs in one transaction, so a failure leaves the tables untouched.
-- Statements are idempotent: rows already carrying a channelId are skipped.
BEGIN;

-- --- Tickets -----------------------------------------------------------------
-- A ticket points at its channel when the ticket's org has exactly one channel
-- of the ticket's own type (Ticket.source holds the ChannelType value).
WITH resolved AS (
  SELECT DISTINCT ON (t.id)
    t.id AS ticket_id,
    c.id AS channel_id
  FROM "Ticket" t
  JOIN "Channel" c
    ON c."orgId" = t."orgId"
   AND c.channel = t.source::"ChannelType"
  WHERE t."channelId" IS NULL
    AND t."source" IN ('EMAIL', 'TELEGRAM')
    AND (
      SELECT count(*)
      FROM "Channel" c2
      WHERE c2."orgId" = t."orgId"
        AND c2.channel = t.source::"ChannelType"
    ) = 1
  ORDER BY t.id, c.id
)
UPDATE "Ticket" t
SET "channelId" = r.channel_id
FROM resolved r
WHERE t.id = r.ticket_id;

-- --- Ingestion events --------------------------------------------------------
-- An event inherits its channel from the ticket it created. Events with no
-- ticket yet (an event whose triage has not finished, or failed) stay null.
WITH resolved AS (
  SELECT DISTINCT ON (e.id)
    e.id AS event_id,
    t."channelId" AS channel_id
  FROM "IngestionEvent" e
  JOIN "Ticket" t ON t.id = e."ticketId"
  WHERE e."channelId" IS NULL
    AND t."channelId" IS NOT NULL
  ORDER BY e.id, t."channelId"
)
UPDATE "IngestionEvent" e
SET "channelId" = r.channel_id
FROM resolved r
WHERE e.id = r.event_id;

-- --- Report ------------------------------------------------------------------
-- Check these against the pre migration counts before moving on to the tighten
-- phase. "still null" on a TELEGRAM row is the signal that it needs a hand.
DO $$
DECLARE
  ticket_linked bigint;
  ticket_unresolved bigint;
  event_linked bigint;
  event_unresolved bigint;
BEGIN
  SELECT count(*) INTO ticket_linked
  FROM "Ticket" WHERE "channelId" IS NOT NULL;

  SELECT count(*) INTO ticket_unresolved
  FROM "Ticket"
  WHERE "channelId" IS NULL
    AND source IN ('EMAIL', 'TELEGRAM');

  SELECT count(*) INTO event_linked
  FROM "IngestionEvent" WHERE "channelId" IS NOT NULL;

  SELECT count(*) INTO event_unresolved
  FROM "IngestionEvent" e
  WHERE e."channelId" IS NULL
    AND (
      e.channel = 'TELEGRAM'
      OR EXISTS (SELECT 1 FROM "Ticket" t WHERE t.id = e."ticketId")
    );

  RAISE NOTICE 'backfill-channel-links: tickets linked % / unresolved %',
    ticket_linked, ticket_unresolved;
  RAISE NOTICE 'backfill-channel-links: events linked % / unresolved %',
    event_linked, event_unresolved;
END $$;

COMMIT;