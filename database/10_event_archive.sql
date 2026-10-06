-- Soft-deleted events stay in the database until an organizer deletes them
-- from the Archive screen.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE event
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
