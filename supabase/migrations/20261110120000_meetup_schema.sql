-- ─────────────────────────────────────────────────────────────────
-- Meet up — core schema
--
-- Identity: every visitor signs in anonymously (Supabase anonymous
-- auth), so auth.uid() exists without any signup. Rows are tied to
-- that uid, which is what lets RLS say "only people in this room can
-- see it" and "you can only change your own status".
--
-- Access model: the invite code is the secret. Knowing it lets you
-- preview and join a room (via security-definer RPCs). Once joined,
-- plain RLS grants read access to that room and nothing else, and
-- Realtime pushes changes only to members.
-- ─────────────────────────────────────────────────────────────────

create type public.participant_status as enum ('idle', 'moving', 'arrived', 'late');

-- ── Tables ──────────────────────────────────────────────────────

create table public.meetups (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9-]{3,64}$'),
  title       text not null check (char_length(title) between 1 and 140),
  venue       text not null check (char_length(venue) between 1 and 120),
  area        text not null default '' check (char_length(area) <= 160),
  when_label  text not null check (char_length(when_label) between 1 and 60),
  starts_at   timestamptz not null,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.participants (
  id          uuid primary key default gen_random_uuid(),
  meetup_id   uuid not null references public.meetups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 18),
  tint        text not null check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  is_host     boolean not null default false,
  status      public.participant_status not null default 'idle',
  note        text not null default '' check (char_length(note) <= 60),
  -- Travel window: the map interpolates the pin from (start_x, start_y)
  -- toward the venue between left_at and eta_at. No GPS involved.
  left_at     timestamptz,
  eta_at      timestamptz,
  arrived_at  timestamptz,
  start_x     real not null default 50 check (start_x between 0 and 100),
  start_y     real not null default 50 check (start_y between 0 and 100),
  joined_at   timestamptz not null default now(),
  unique (meetup_id, user_id)
);

create index participants_meetup_idx on public.participants (meetup_id);
create index participants_user_idx on public.participants (user_id);

create table public.nudges (
  id               bigint generated always as identity primary key,
  meetup_id        uuid not null references public.meetups (id) on delete cascade,
  from_participant uuid not null references public.participants (id) on delete cascade,
  to_participant   uuid not null references public.participants (id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index nudges_meetup_idx on public.nudges (meetup_id);

-- ── Membership check ────────────────────────────────────────────
-- security definer so policies on participants can call it without
-- recursing into participants' own RLS.

create function public.is_member(p_meetup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants p
    where p.meetup_id = p_meetup and p.user_id = auth.uid()
  );
$$;

-- ── Row level security ─────────────────────────────────────────

alter table public.meetups      enable row level security;
alter table public.participants enable row level security;
alter table public.nudges       enable row level security;

create policy "members read their meetups"
  on public.meetups for select to authenticated
  using (public.is_member(id));

create policy "members read their roster"
  on public.participants for select to authenticated
  using (public.is_member(meetup_id));

create policy "you update your own row"
  on public.participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members read nudges"
  on public.nudges for select to authenticated
  using (public.is_member(meetup_id));

-- Writes other than your own status go through the RPCs below, so lock
-- the tables down to exactly that. Column grants stop a client from
-- promoting itself to host or moving its row into another room.
revoke all on public.meetups, public.participants, public.nudges from anon, authenticated;
grant select on public.meetups, public.participants, public.nudges to authenticated;
grant update (status, note, left_at, eta_at, arrived_at) on public.participants to authenticated;

-- ── RPCs ────────────────────────────────────────────────────────

-- Create a room and its host in one step. Returns the invite code.
create function public.create_meetup(
  p_venue          text,
  p_area           text,
  p_when_label     text,
  p_minutes_from_now integer,
  p_host_name      text
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

  insert into public.meetups (code, title, venue, area, when_label, starts_at, created_by)
  values (
    v_code,
    'Meeting at ' || v_venue,
    left(v_venue, 120),
    left(coalesce(nullif(btrim(p_area), ''), p_venue), 160),
    left(p_when_label, 60),
    now() + make_interval(mins => greatest(p_minutes_from_now, 0)),
    v_uid
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

-- What the invite screen shows before you join: the plan and who's in.
-- Anyone holding the code may read this — that's the point of the link.
create function public.get_meetup_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'meetup', to_jsonb(m) - 'created_by',
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name,
        'tint', p.tint,
        'status', p.status,
        'is_host', p.is_host
      ) order by p.joined_at)
      from public.participants p
      where p.meetup_id = m.id
    ), '[]'::jsonb)
  )
  from public.meetups m
  where m.code = p_code;
$$;

-- Join a room by code. Idempotent: re-joining returns your existing row.
create function public.join_meetup(p_code text, p_name text, p_tint text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_meetup  uuid;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select id into v_meetup from public.meetups where code = p_code;
  if v_meetup is null then
    raise exception 'meetup not found' using errcode = 'P0002';
  end if;

  select id into v_id from public.participants
  where meetup_id = v_meetup and user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  if (select count(*) from public.participants where meetup_id = v_meetup) >= 30 then
    raise exception 'this meetup is full' using errcode = '53400';
  end if;

  insert into public.participants (meetup_id, user_id, name, tint, start_x, start_y)
  values (
    v_meetup,
    v_uid,
    left(coalesce(nullif(btrim(p_name), ''), 'Friend'), 18),
    case when p_tint ~ '^#[0-9A-Fa-f]{6}$' then p_tint else '#FFB59E' end,
    -- Scatter new arrivals around the edges of the map.
    15 + random() * 70,
    15 + random() * 25
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Nudge one person, or everyone not yet arrived (p_to = null).
-- Returns how many nudges were sent.
create function public.send_nudge(p_meetup uuid, p_to uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from  uuid;
  v_count integer;
begin
  select id into v_from from public.participants
  where meetup_id = p_meetup and user_id = auth.uid();
  if v_from is null then
    raise exception 'not a member of this meetup' using errcode = '42501';
  end if;

  insert into public.nudges (meetup_id, from_participant, to_participant)
  select p_meetup, v_from, p.id
  from public.participants p
  where p.meetup_id = p_meetup
    and p.id <> v_from
    and p.status <> 'arrived'
    and (p_to is null or p.id = p_to);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.is_member(uuid) from public;
revoke all on function public.create_meetup(text, text, text, integer, text) from public;
revoke all on function public.get_meetup_preview(text) from public;
revoke all on function public.join_meetup(text, text, text) from public;
revoke all on function public.send_nudge(uuid, uuid) from public;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_meetup(text, text, text, integer, text) to authenticated;
grant execute on function public.get_meetup_preview(text) to authenticated;
grant execute on function public.join_meetup(text, text, text) to authenticated;
grant execute on function public.send_nudge(uuid, uuid) to authenticated;

-- ── Realtime ────────────────────────────────────────────────────
-- Postgres Changes respects RLS, so members only receive their room.

alter publication supabase_realtime add table public.meetups, public.participants, public.nudges;
