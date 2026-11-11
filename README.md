# Meet up

A mobile-first group coordination app: create a room, share one link, and watch
the whole group close in on the spot — live GPS if you opt in, an ETA if you
don't. No installs, no accounts.

The UI is ported from the Google Stitch project **“Meet Up Group Tracker.”** See
[`design/README.md`](design/README.md) for the screen-by-screen mapping and the
token translation.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components) + **React 19**
- **Tailwind CSS v4** — design tokens in `app/globals.css` under `@theme`
- **Supabase** — Postgres, anonymous auth, Row Level Security, Realtime
- **OpenStreetMap** — Photon place search, Leaflet map tiles (no API keys)
- **TypeScript**

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To try it as two people, open the invite link
in a second browser or a private window: each browser is its own identity.

## Backend setup

The app talks to Supabase directly from the browser. Everything it can touch is
enforced by RLS policies and a few `security definer` functions in
[`supabase/migrations/`](supabase/migrations/).

**Using the existing project** (`meetup`, ref `izadfplukjbllrqrqvlb`, Mumbai):
copy `.env.example` to `.env.local` and fill in the URL and publishable key
from the Supabase dashboard → Settings → API Keys.

**Setting up a fresh project:**

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push --remote
npx supabase config push
```

`config push` turns on anonymous sign-ins (declared in `supabase/config.toml`).
Run `npx supabase config diff` first: the file also declares other auth and
pooler settings, and they're set to match Supabase's hosted defaults so that
push doesn't weaken anything. Keep it that way when editing.

> If the CLI says "Invalid access token" right after logging in, a stale
> `SUPABASE_ACCESS_TOKEN` is set in your environment and overrides the login.
> Remove it, or prefix commands with `env -u SUPABASE_ACCESS_TOKEN`.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing: start a meetup, paste an invite, or reopen your rooms |
| `/create` | Pick the spot, the time, and your name; mints the invite code |
| `/j/[code]` | Invite screen: plan summary, who's in, pick a name + avatar tint |
| `/m/[code]` | Live room — solo lobby when you're first, friend tracker once others join |
| `/m/[code]/recap` | Shareable recap: arrival order, roast, group stats |

## How it fits together

```
app/                 routes (client components)
components/          AppHeader, MapCanvas, VenueMap, VenuePicker, LiveTracker,
                     WaitingState, EtaSheet, Toast, ui
lib/geocode.ts       Photon place search + directions link
lib/geo.ts           distance, travel time, freshness
lib/useLocationSharing.ts  opt-in GPS: watch, publish, auto leave/arrive
lib/supabase.ts      lazy browser client + anonymous session
lib/room.ts          useRoom (member/preview + Realtime), useMyRooms, writes
lib/types.ts         domain shapes, row mappers, ETA/orbit/late derivations
lib/useNow.ts        clock and origin as external stores
supabase/            config.toml + migrations
design/              where the UI came from
```

### Access model

- **Identity:** every browser signs in anonymously on first visit, so
  `auth.uid()` exists without a signup.
- **The invite code is the secret.** It ends in 8 random hex characters.
  Holding it lets you preview a room (`get_meetup_preview`) and join it
  (`join_meetup`).
- **Once you've joined**, RLS lets you read that room's meetup, roster and
  nudges, and nothing else. Realtime respects the same policies.
- **Writes are narrow:** you can update only your own row, and only the status
  columns (column-level grants). Creating rooms, joining and nudging go through
  RPCs.

### Maps and place search

- **Place search** (`lib/geocode.ts`) queries [Photon](https://photon.komoot.io),
  an OpenStreetMap geocoder built for search-as-you-type, straight from the
  browser. Typing is debounced and results are cached. Picking a result stores
  the venue's coordinates on the meetup (`venue_lat`/`venue_lng`). Venues used
  "without a map" have no coordinates and get the drawn street grid instead.
- **The map** (`components/VenueMap.tsx`) is Leaflet with OpenStreetMap tiles,
  non-interactive, framing the venue plus everyone sharing GPS. Callers draw
  pins in React through a `project(lat, lng)` render prop. "Open maps" hands off
  to the phone's maps app with the exact coordinates. The © OpenStreetMap
  credit must stay visible; overlays are kept away from the bottom-right corner.

### Live GPS location

Sharing is opt-in per person and per room (`lib/useLocationSharing.ts`). While
it's on and the room is open:

- the browser's `watchPosition` feeds fixes, published at most every 15 s
  (sooner after moving 30 m) into the participant's own row;
- moving 150 m from where sharing started flips you to "on the way";
- coming within ~80 m of the venue marks you arrived and stops the watch;
- an optional screen wake lock keeps the phone from sleeping mid-trip.

Distance and a rough travel time come from `lib/geo.ts` (reported speed, or a
~20 km/h city average). A position older than 2 minutes shows as "last seen".

**Privacy is enforced by the database, not the client.** Positions are readable
only by room members (existing RLS). A trigger erases a position the moment its
owner is marked arrived, a `pg_cron` job clears any position not updated for 3
hours, and "Stop sharing" erases it immediately. Only the latest fix is stored,
never a trail.

**Web limitation:** browsers stop delivering location to a page in the
background, so sharing only runs while the room is open on screen. Background
tracking would need a native app.

### ETA fallback

People who can't or won't share location tap "Use an ETA": that records
`left_at` and a self-reported `eta_at`, and the countdown and "late" flag derive
from those. With nobody sharing GPS, everyone *orbits* the venue pin by ETA
(`orbitOffset`): closer means arriving sooner. Once anyone shares, the map turns
purely geographic: live dots at real spots, arrived friends at the pin, and
anyone else in a "not sharing location" strip, not at a made-up distance.

### Patterns to keep

- **Nothing reads the clock or browser storage during render.** Cache
  Components rejects it, so both go through `useSyncExternalStore`.
- **Dynamic routes wrap their screen in `<Suspense>`**, because `useParams()`
  is runtime-only.
- **The Supabase client is created lazily**, never at module load, so
  `next build` works without env vars.
- **Realtime: subscribe first, then fetch.** `useRoom` waits for the server to
  confirm the subscription (`postgres_changes_options.wait`) before loading the
  initial state, so nothing slips through the gap. Channel topics are unique
  per hook instance, because supabase-js reuses a channel when the topic
  matches.

## Known gaps

- **Location only updates while the room is open on screen.** A web limit; see
  "Live GPS location".
- **Place search is fair-use and literal.** Photon's free public instance asks
  for light use, and it doesn't correct typos ("thurbe" won't find Turbhe).
  For heavy traffic, self-host Photon or move to a paid geocoder.
- **Anonymous sign-ins are unprotected against abuse.** Supabase rate-limits
  them per IP (30/hour). Add CAPTCHA (Turnstile/hCaptcha) before a public launch.
- **Rooms never expire.** Nothing deletes old meetups yet.
- **Nudges notify only while the room is open.** No push notifications.
- **The QR code** is decorative, not a scannable encoding.
- **Not deployed.** When you deploy, add the two `NEXT_PUBLIC_SUPABASE_*`
  variables to the host, and add the production URL to `site_url` /
  `additional_redirect_urls` in `supabase/config.toml`.
