-- A player can be designated to collect money without becoming an organizer.
-- Run this connected to the application database as the table owner.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'league_member'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE league_member DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE league_member
    ADD CONSTRAINT league_member_role_check
    CHECK (role IN ('organizer', 'player', 'collector'));
