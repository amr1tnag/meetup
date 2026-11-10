# Meet up

A mobile-first group coordination app: create a room, share one link, and watch
the whole group close in on the spot. No installs, no accounts, no GPS.

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

The venue is real; friends' positions are not.

- **Place search** (`lib/geocode.ts`) queries [Photon](https://photon.komoot.io),
  an OpenStreetMap geocoder built for search-as-you-type, straight from the
  browser. Typing is debounced and results are cached. Picking a result stores
  the venue's coordinates on the meetup (`venue_lat`/`venue_lng`). Venues used
  "without a map" have no coordinates and get the drawn street grid instead.
- **The map** (`components/VenueMap.tsx`) is Leaflet with OpenStreetMap tiles,
  centred on the venue and deliberately non-interactive. "Open maps" hands off
  to the phone's maps app with the exact coordinates. The © OpenStreetMap
  credit must stay visible; overlays are kept away from the bottom-right corner.

### Live updates without GPS

Tapping "I've left" records `left_at` and a self-reported `eta_at`. Everything
live is derived from those two timestamps and the clock (`lib/types.ts`): the
countdown, flipping to "late" once the ETA passes, and each friend's place on
the map. Friends *orbit* the venue pin (`orbitOffset`): arrived friends huddle
at the pin, people en route sit further out the longer their ETA and glide in
as it counts down, and anyone who hasn't left waits on the outer ring. Distance
on the map means time, not geography, and the map says so ("Closer to the pin =
arriving sooner").

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

- **No real location for friends.** The orbit shows ETA, not where anyone is.
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
