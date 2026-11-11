-- ─────────────────────────────────────────────────────────────────
-- Safety net: nobody's position outlives the meetup.
--
-- Someone who shares location and never arrives (left early, phone
-- died) would otherwise keep their last position forever. Every 15
-- minutes, clear any position not updated in the last 3 hours.
-- Kept in its own migration so the core schema applies even if pg_cron
-- is unavailable.
-- ─────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

select cron.schedule(
  'purge-stale-locations',
  '*/15 * * * *',
  $$
    update public.participants
    set lat = null, lng = null, accuracy_m = null, speed_mps = null, located_at = null
    where located_at is not null
      and located_at < now() - interval '3 hours'
  $$
);
