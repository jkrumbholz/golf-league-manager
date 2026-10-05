-- League manager tables. Course, hole, and tee records stay in the platform
-- database. This schema stores platform ids only.
--
-- Run once against dev_golfleaguemanager and once against prod_golfleaguemanager,
-- after 02_create_users.sql. Do not run this from the application.
--
-- Playing handicaps use Handicap Index directly because the platform API does
-- not store slope or course rating. A card of 9 holes or fewer uses half that
-- index, rounded. Scramble and alternate shot apply their percentage blends
-- to those 9-hole handicaps. An 18-hole card uses the full index.
-- Modified Tri-Play is not included. Payout rows are entered by hand.

CREATE TABLE app_user (
    id                  SERIAL PRIMARY KEY,
    username            TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    handicap_index      NUMERIC(4,1) NOT NULL DEFAULT 0,
    profile_picture_url TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_session (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_session_user_id_idx ON user_session(user_id);

CREATE TABLE league (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    logo_image_url      TEXT,
    entry_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
    home_facility_id    INTEGER,
    created_by_user_id  INTEGER NOT NULL REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_member (
    league_id   INTEGER NOT NULL REFERENCES league(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES app_user(id),
    role        TEXT NOT NULL CHECK (role IN ('organizer', 'player')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (league_id, user_id)
);

CREATE TABLE season (
    id          SERIAL PRIMARY KEY,
    league_id   INTEGER NOT NULL REFERENCES league(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX season_league_id_idx ON season(league_id);

CREATE TABLE event (
    id                      SERIAL PRIMARY KEY,
    season_id               INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    format                  TEXT NOT NULL CHECK (format IN (
                                'stroke_play',
                                'best_ball',
                                'high_ball',
                                'vegas',
                                'up_and_back',
                                'vegas_up_and_back',
                                'oceans_6',
                                'scramble',
                                'alternate_shot'
                            )),
    course_configuration_id INTEGER,
    facility_id             INTEGER,
    entry_fee               NUMERIC(10,2) NOT NULL DEFAULT 0,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    players_pick_teams      BOOLEAN NOT NULL DEFAULT FALSE,
    team_size               INTEGER NOT NULL DEFAULT 1 CHECK (team_size BETWEEN 1 AND 4),
    signup_token            TEXT NOT NULL UNIQUE,
    ctp_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    ctp_entry_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
    long_drive_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    long_drive_entry_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX event_season_id_idx ON event(season_id);

CREATE TABLE round (
    id                      SERIAL PRIMARY KEY,
    event_id                INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    round_number            INTEGER NOT NULL,
    play_date               DATE NOT NULL,
    course_configuration_id INTEGER,
    UNIQUE (event_id, round_number)
);

-- Lower ladder_order is farther back. Up & Back moves that way when the team is net under par.
CREATE TABLE round_tee_set (
    id                  SERIAL PRIMARY KEY,
    round_id            INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
    platform_tee_set_id INTEGER NOT NULL,
    name                TEXT NOT NULL,
    hex_color_code      TEXT,
    ladder_order        INTEGER NOT NULL,
    UNIQUE (round_id, ladder_order),
    UNIQUE (round_id, platform_tee_set_id)
);

CREATE TABLE round_hole (
    id                      SERIAL PRIMARY KEY,
    round_id                INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
    sequence                INTEGER NOT NULL,
    platform_hole_id        INTEGER NOT NULL,
    display_hole_number     INTEGER,
    par                     INTEGER NOT NULL,
    stroke_index            INTEGER,
    default_tee_set_id      INTEGER REFERENCES round_tee_set(id),
    UNIQUE (round_id, sequence)
);

CREATE TABLE event_registration (
    id                  SERIAL PRIMARY KEY,
    event_id            INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES app_user(id),
    paid                BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at             TIMESTAMPTZ,
    ctp_entered         BOOLEAN NOT NULL DEFAULT FALSE,
    long_drive_entered  BOOLEAN NOT NULL DEFAULT FALSE,
    ctp_paid            BOOLEAN NOT NULL DEFAULT FALSE,
    long_drive_paid     BOOLEAN NOT NULL DEFAULT FALSE,
    handicap_index      NUMERIC(4,1) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE TABLE team (
    id                  SERIAL PRIMARY KEY,
    event_id            INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    created_by_user_id  INTEGER REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX team_event_id_idx ON team(event_id);

CREATE TABLE team_member (
    team_id INTEGER NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_user(id),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE score (
    id                  SERIAL PRIMARY KEY,
    round_id            INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
    sequence            INTEGER NOT NULL,
    user_id             INTEGER REFERENCES app_user(id),
    team_id             INTEGER REFERENCES team(id) ON DELETE CASCADE,
    gross               INTEGER,
    kept                BOOLEAN,
    updated_by_user_id  INTEGER REFERENCES app_user(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT score_owner CHECK (
        (user_id IS NOT NULL AND team_id IS NULL)
        OR (user_id IS NULL AND team_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX score_user_hole_idx
    ON score (round_id, sequence, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX score_team_hole_idx
    ON score (round_id, sequence, team_id)
    WHERE team_id IS NOT NULL;

CREATE TABLE side_game_result (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    competition     TEXT NOT NULL CHECK (competition IN ('closest_to_pin', 'long_drive')),
    winner_user_id  INTEGER REFERENCES app_user(id),
    UNIQUE (event_id, competition)
);

CREATE TABLE payout (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES app_user(id),
    team_id     INTEGER REFERENCES team(id) ON DELETE SET NULL,
    place       INTEGER,
    amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payout_event_id_idx ON payout(event_id);

-- One row is one group. A foursome is at most 4 players: one 4-player team,
-- two 2-player teams, or up to four individuals. Threesomes leave a spot empty.
-- Several groups may share a tee time when they start on different holes.
-- The application enforces the 4-player cap.
CREATE TABLE tee_group (
    id             SERIAL PRIMARY KEY,
    event_id       INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    tee_time       TIME NOT NULL,
    starting_hole  INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tee_group_event_id_idx ON tee_group(event_id);

CREATE UNIQUE INDEX tee_group_event_time_hole_idx
    ON tee_group (event_id, tee_time, starting_hole);

CREATE TABLE tee_group_member (
    id            SERIAL PRIMARY KEY,
    tee_group_id  INTEGER NOT NULL REFERENCES tee_group(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES app_user(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES team(id) ON DELETE CASCADE,
    CONSTRAINT tee_group_member_owner CHECK (
        (user_id IS NOT NULL AND team_id IS NULL)
        OR (user_id IS NULL AND team_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX tee_group_member_user_idx
    ON tee_group_member (tee_group_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX tee_group_member_team_idx
    ON tee_group_member (tee_group_id, team_id)
    WHERE team_id IS NOT NULL;

-- Tables above are created by whoever runs this file. Grant that data to the
-- application role for the database you are connected to.
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
