-- ─────────────────────────────────────────────────────────────────
-- Live GPS location, opt-in per person.
--
-- Only the latest position is kept (no trail). It's visible to the
-- room's members through the existing RLS policy on participants, and
-- it's wiped by the database itself:
--   • the moment someone is marked arrived (trigger below), and
--   • a few hours after their last update (scheduled purge, next file).
-- ─────────────────────────────────────────────────────────────────

alter table public.participants
  add column lat        double precision check (lat between -90 and 90),
  add column lng        double precision check (lng between -180 and 180),
  add column accuracy_m real check (accuracy_m >= 0),
  add column speed_mps  real check (speed_mps >= 0),
  add column located_at timestamptz,
  add constraint participants_location_both_or_neither
    check ((lat is null) = (lng is null));

-- Members may write their own position (row ownership is already enforced
-- by the "you update your own row" policy).
grant update (lat, lng, accuracy_m, speed_mps, located_at)
  on public.participants to authenticated;

-- Arriving erases your location, whatever the client does.
create function public.erase_location_on_arrival()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'arrived' then
    new.lat := null;
    new.lng := null;
    new.accuracy_m := null;
    new.speed_mps := null;
    new.located_at := null;
  end if;
  return new;
end;
$$;

create trigger participants_erase_location_on_arrival
  before update on public.participants
  for each row
  execute function public.erase_location_on_arrival();
