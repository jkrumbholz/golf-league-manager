-- Organizers turn score entry on for an event. It stays off until they do.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE event
    ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
