-- Tee times for an event. Run once against dev_golfleaguemanager and once
-- against prod_golfleaguemanager, after 03_schema.sql. Do not run this from
-- the application.
--
-- A group is one tee time. The app allows at most 4 players in it: one
-- 4-player team, two 2-player teams, or up to four individuals.

CREATE TABLE IF NOT EXISTS tee_group (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    tee_time    TIME NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tee_group_event_id_idx ON tee_group(event_id);

CREATE TABLE IF NOT EXISTS tee_group_member (
    id            SERIAL PRIMARY KEY,
    tee_group_id  INTEGER NOT NULL REFERENCES tee_group(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES app_user(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES team(id) ON DELETE CASCADE,
    CONSTRAINT tee_group_member_owner CHECK (
        (user_id IS NOT NULL AND team_id IS NULL)
        OR (user_id IS NULL AND team_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS tee_group_member_user_idx
    ON tee_group_member (tee_group_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tee_group_member_team_idx
    ON tee_group_member (tee_group_id, team_id)
    WHERE team_id IS NOT NULL;

DO $$
BEGIN
  IF current_database() = 'dev_golfleaguemanager' THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO golfleaguemanagerdev';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO golfleaguemanagerdev';
  ELSIF current_database() = 'prod_golfleaguemanager' THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO golfleaguemanagerprod';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO golfleaguemanagerprod';
  ELSE
    RAISE EXCEPTION 'Connect to dev_golfleaguemanager or prod_golfleaguemanager before running this script';
  END IF;
END $$;
