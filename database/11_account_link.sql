-- Let an organizer send a 3-day link so a player can choose a username and
-- password, or reset a password they forgot.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE app_user ALTER COLUMN username DROP NOT NULL;
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS account_link (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    purpose     TEXT NOT NULL CHECK (purpose IN ('setup', 'reset')),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_link_user_id_idx ON account_link(user_id);

-- The application role does not own tables created by the login that runs
-- this file, so it needs an explicit grant or the setup link insert fails.
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
