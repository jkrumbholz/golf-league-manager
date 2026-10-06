-- Allow the Low / High / Combo team format.
-- Run once against dev_golfleaguemanager and prod_golfleaguemanager.

ALTER TABLE event DROP CONSTRAINT IF EXISTS event_format_check;

ALTER TABLE event ADD CONSTRAINT event_format_check CHECK (format IN (
    'stroke_play',
    'best_ball',
    'high_ball',
    'vegas',
    'up_and_back',
    'vegas_up_and_back',
    'oceans_6',
    'scramble',
    'alternate_shot',
    'low_high_total'
));
