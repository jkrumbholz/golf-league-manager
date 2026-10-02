-- Index used for this event. Later profile changes do not rewrite a played event.
-- Backfill from the current profile. If a finished event should keep an older
-- index, set that profile index back before running this, then change it after.
ALTER TABLE event_registration
    ADD COLUMN IF NOT EXISTS handicap_index NUMERIC(4,1);

UPDATE event_registration r
SET handicap_index = u.handicap_index
FROM app_user u
WHERE u.id = r.user_id
  AND r.handicap_index IS NULL;

ALTER TABLE event_registration
    ALTER COLUMN handicap_index SET DEFAULT 0,
    ALTER COLUMN handicap_index SET NOT NULL;
