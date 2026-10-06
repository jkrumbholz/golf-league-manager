-- Event handicap allowance, as a percent of the playing handicap.
-- 100 keeps the full index. 50 plays half the strokes, for a plus index too.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE event
    ADD COLUMN IF NOT EXISTS handicap_allowance NUMERIC(5,1);

UPDATE event
SET handicap_allowance = 100
WHERE handicap_allowance IS NULL;

ALTER TABLE event
    ALTER COLUMN handicap_allowance SET DEFAULT 100,
    ALTER COLUMN handicap_allowance SET NOT NULL;
