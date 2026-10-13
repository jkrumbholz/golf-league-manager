-- One player in a team event can be given a virtual partner. The teammate is
-- drawn after the round and stays on their original team as well.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE team
    ADD COLUMN IF NOT EXISTS virtual_partner BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS team_one_virtual_partner_idx
    ON team (event_id)
    WHERE virtual_partner;

CREATE TABLE IF NOT EXISTS virtual_partner_draw (
    event_id            INTEGER PRIMARY KEY REFERENCES event(id) ON DELETE CASCADE,
    team_id             INTEGER NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    designated_user_id  INTEGER NOT NULL REFERENCES app_user(id),
    selected_user_id    INTEGER REFERENCES app_user(id),
    drawn_at            TIMESTAMPTZ,
    drawn_by_user_id    INTEGER REFERENCES app_user(id)
);

CREATE TABLE IF NOT EXISTS virtual_partner_redraw (
    id                  SERIAL PRIMARY KEY,
    event_id            INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    previous_user_id    INTEGER REFERENCES app_user(id),
    selected_user_id    INTEGER REFERENCES app_user(id),
    organizer_user_id   INTEGER REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The application role does not own tables created by the login that runs
-- this file, so it needs an explicit grant or event setup fails.
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
