-- Name as copied from GHIN, when a nickname would miss the handicap paste.
-- Organizers set this. Players do not.
-- Run this connected to the application database as the table owner.

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS ghin_name TEXT;
