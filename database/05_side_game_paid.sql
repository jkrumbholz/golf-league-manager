-- Cash collected for optional side games. Signup still records that a player
-- wants to enter. These flags are what the organizer marks when the money is in.
ALTER TABLE event_registration
    ADD COLUMN IF NOT EXISTS ctp_paid BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS long_drive_paid BOOLEAN NOT NULL DEFAULT FALSE;
