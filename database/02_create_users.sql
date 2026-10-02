-- Creates the application login roles, then grants them access.
-- CREATE USER can run from any database.
-- The GRANT statements on schema public only apply to the database you are
-- connected to. Run the dev section while connected to dev_golfleaguemanager,
-- and the prod section while connected to prod_golfleaguemanager.
-- Replace the passwords before running. Do not run this from the application.

CREATE USER golfleaguemanagerdev
WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOINHERIT;

CREATE USER golfleaguemanagerprod
WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOINHERIT;

-- ----- connected to dev_golfleaguemanager -----

REVOKE ALL ON DATABASE dev_golfleaguemanager FROM PUBLIC;
REVOKE ALL ON DATABASE dev_golfleaguemanager FROM golfleaguemanagerdev;
GRANT CONNECT ON DATABASE dev_golfleaguemanager TO golfleaguemanagerdev;

REVOKE ALL ON SCHEMA public FROM golfleaguemanagerdev;
GRANT USAGE ON SCHEMA public TO golfleaguemanagerdev;
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO golfleaguemanagerdev;
GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO golfleaguemanagerdev;
GRANT EXECUTE
ON ALL PROCEDURES IN SCHEMA public
TO golfleaguemanagerdev;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
TO golfleaguemanagerdev;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS
TO golfleaguemanagerdev;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO golfleaguemanagerdev;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES
TO golfleaguemanagerdev;

-- ----- connected to prod_golfleaguemanager -----

REVOKE ALL ON DATABASE prod_golfleaguemanager FROM PUBLIC;
REVOKE ALL ON DATABASE prod_golfleaguemanager FROM golfleaguemanagerprod;
GRANT CONNECT ON DATABASE prod_golfleaguemanager TO golfleaguemanagerprod;

REVOKE ALL ON SCHEMA public FROM golfleaguemanagerprod;
GRANT USAGE ON SCHEMA public TO golfleaguemanagerprod;
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO golfleaguemanagerprod;
GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO golfleaguemanagerprod;
GRANT EXECUTE
ON ALL PROCEDURES IN SCHEMA public
TO golfleaguemanagerprod;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
TO golfleaguemanagerprod;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS
TO golfleaguemanagerprod;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO golfleaguemanagerprod;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES
TO golfleaguemanagerprod;
