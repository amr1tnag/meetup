-- ─────────────────────────────────────────────────────────────────
-- Real venue locations.
--
-- The create screen now searches OpenStreetMap (via Photon) and stores
-- the picked place's coordinates so every screen can show a real map.
-- Coordinates stay optional: rooms made before this, or venues typed
-- without picking a search result, fall back to the drawn map.
-- ─────────────────────────────────────────────────────────────────

alter table public.meetups
  add column venue_lat double precision check (venue_lat between -90 and 90),
  add column venue_lng double precision check (venue_lng between -180 and 180),
  add constraint meetups_coords_both_or_neither
    check ((venue_lat is null) = (venue_lng is null));

-- Same function, two optional parameters on the end. Postgres treats a
-- new signature as a separate overload, so drop the old one first rather
-- than leave two create_meetup functions around.
drop function public.create_meetup(text, text, text, integer, text);

create function public.create_meetup(
  p_venue            text,
  p_area             text,
  p_when_label       text,
  p_minutes_from_now integer,
  p_host_name        text,
  p_lat              double precision default null,
  p_lng              double precision default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_venue text := btrim(split_part(p_venue, ',', 1));
  v_slug  text;
  v_code  text;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_venue = '' then
    raise exception 'venue is required' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'pass both coordinates or neither' using errcode = '22023';
  end if;

  -- Readable slug from the first two words of the venue…
  v_slug := array_to_string(
    (regexp_split_to_array(
      btrim(regexp_replace(lower(v_venue), '[^a-z0-9 ]', '', 'g')),
      '\s+'
    ))[1:2],
    '-'
  );
  if v_slug is null or v_slug = '' then
    v_slug := 'meetup';
  end if;

  -- …plus 8 random hex chars. The code is the room's only secret, so it
  -- has to be unguessable, not just unique.
  loop
    v_code := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.meetups where code = v_code);
  end loop;

  insert into public.meetups (
    code, title, venue, area, when_label, starts_at, created_by, venue_lat, venue_lng
  )
  values (
    v_code,
    'Meeting at ' || v_venue,
    left(v_venue, 120),
    left(coalesce(nullif(btrim(p_area), ''), p_venue), 160),
    left(p_when_label, 60),
    now() + make_interval(mins => greatest(p_minutes_from_now, 0)),
    v_uid,
    p_lat,
    p_lng
  )
  returning id into v_id;

  insert into public.participants (meetup_id, user_id, name, tint, is_host, note, start_x, start_y)
  values (
    v_id,
    v_uid,
    left(coalesce(nullif(btrim(p_host_name), ''), 'Organizer'), 18),
    '#FF5A1F',
    true,
    'organizer',
    50,
    50
  );

  return v_code;
end;
$$;

revoke all on function public.create_meetup(text, text, text, integer, text, double precision, double precision) from public;
grant execute on function public.create_meetup(text, text, text, integer, text, double precision, double precision) to authenticated;
