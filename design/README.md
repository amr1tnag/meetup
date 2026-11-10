# Design source — Google Stitch

The UI in this repo is ported from the Stitch project **“Meet Up Group Tracker.”**

- **Project:** `projects/7012198656768175365`
- **Device target:** MOBILE (390px baseline, 540px max column)
- **Design system asset:** `assets/d6c5df2e61ee4195b60599f45a7879c0`
- **Open it:** https://stitch.withgoogle.com

## Screens and where they landed

| Stitch screen | Screen ID | Route in this app |
| --- | --- | --- |
| Create a Plan | `1ff74872a2d84280b70b6e99c545a80f` | `/create` |
| Join via Link | `3e09435297614be6afadeed4112f8d13` | `/j/[code]` |
| Live Meetup | `a8b866948eb94d68b766ae76e8d271c2` | `/m/[code]` (populated room) |
| Live Meetup – Waiting State | `95461facc2d946f1a077504ab1474b94` | `/m/[code]` (solo room) |
| Recap Card | `0be8c19b137f4a52baf7ab9bdcac9ade` | `/m/[code]/recap` |
| Live Meetup – Interactive Nudges | `1cfa5f64d9b34f44ab041eeda123451e` | folded into `/m/[code]` (nudge actions) |
| Live Meetup – Animated Routes | `6f4db1d5c8a240e3b387b6bdc582c7f7` | folded into `/m/[code]` (marker drift) |

`/` is a landing screen with no Stitch counterpart — it was built from the same
token set to connect the four designed flows.

## Re-pulling a screen

Stitch is wired in over MCP, so any screen's source can be fetched again without
leaving the editor:

- `list_screens` with `projectId: 7012198656768175365` — lists screens with the
  file entry names for their HTML and screenshots.
- `download_file` with e.g.
  `projects/7012198656768175365/screens/<screenId>/fileEntries/html` — returns the
  raw Tailwind-CDN HTML.
- Swap `/fileEntries/html` for `/fileEntries/screenshot` to get the PNG.

Fetch the HTML rather than the `downloadUrl`; those URLs need credentials.

## Token mapping

Stitch exports a `tailwind.config` block for Tailwind v3 and loads Tailwind from
a CDN. This app runs Tailwind v4, so those tokens live in
[`app/globals.css`](../app/globals.css) under `@theme`, with the Stitch names
kept intact so parity stays checkable:

| Stitch | Tailwind v4 |
| --- | --- |
| `colors` | `--color-*` (`bg-surface`, `text-on-surface`, …) |
| `fontSize` | `--text-*` (`text-headline-md`, `text-label-status`, …) |
| `fontFamily` | collapsed to `--font-headline` (Space Grotesk) / `--font-body` (DM Sans) |
| `spacing` | `--spacing-*` (`px-margin`, `gap-space-sm`, …) |
| `borderRadius` | `--radius-*`, plus `--radius-sticker` (20px cards) |

The hard-offset neo-brutalist shadows become the `sticker-xs` / `sticker-sm` /
`sticker` / `sticker-md` / `sticker-lg` utilities, and the mechanical
button-press (`translate(2px,2px)` with a collapsing shadow) is the `press`
utility.

## Deliberate deviations

- **Map tiles.** The Stitch screens hotlinked Google-hosted static map images on
  `lh3.googleusercontent.com`, which expire. They're replaced by real
  OpenStreetMap tiles (Leaflet) centred on the venue the host searched for,
  tinted toward the sticker palette. The drawn SVG street grid remains only as
  the fallback for venues with no coordinates.
- **Friend pins orbit the venue** instead of sitting at street positions. The
  design implied live GPS; this app has none, so distance from the pin encodes
  ETA. The design's "Slow traffic" pin label became a plain "Late".
- **Logo.** Also a hotlinked asset; replaced with an inline pin mark in
  `components/AppHeader.tsx`.
- **Recap numbers.** The design showed fixed figures (51 min wait, "avg 42
  km/h"). The recap now computes wait time, punctuality MVP, last arrival and
  nudge counts from actual arrival timestamps. Speed isn't derivable without real
  GPS, so that tile became "Last in".
- **QR code** is a decorative stand-in, not a scannable encoding.
- **Invented social proof removed.** The join screen's "Sneha says: get the
  butter chicken sliders" bubble and "Bill split auto-ready" tag were sample
  content with no data behind them, so they're gone.
- **Waiting state's "Poke Group"** became "Ping the chat": with nobody in the
  room yet there's no one to nudge in-app, so it re-opens the share sheet.
- **"Running Late" on the tracker** now carries a nudge button instead of a
  second "Running late" label, since the status chip already says it.
- **ETA picker** is new. The design's "I've left the house!" button now asks
  how long you'll be; that number drives every countdown and the map pins.
