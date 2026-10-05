-- Starting hole for a group. Several groups may share a tee time when they
-- start on different holes. Tee time plus starting hole is unique per event.
-- Run once against dev_golfleaguemanager and once against prod_golfleaguemanager,
-- after 06_registration_handicap.sql. Do not run this from the application.

ALTER TABLE tee_group
    ADD COLUMN IF NOT EXISTS starting_hole INTEGER;

-- Groups that already share a time get distinct holes so the unique key can be added.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY event_id, tee_time ORDER BY id) AS n
    FROM tee_group
    WHERE starting_hole IS NULL
)
UPDATE tee_group g
SET starting_hole = ranked.n
FROM ranked
WHERE g.id = ranked.id;

ALTER TABLE tee_group
    ALTER COLUMN starting_hole SET DEFAULT 1;

ALTER TABLE tee_group
    ALTER COLUMN starting_hole SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tee_group_event_time_hole_idx
    ON tee_group (event_id, tee_time, starting_hole);
