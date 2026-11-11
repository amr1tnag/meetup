"use client";

import {
  STATUS_META,
  type Participant,
  etaMinutes,
  initials,
  liveStatus,
  orbitOffset,
} from "@/lib/types";
import { ago, distanceM, formatDistance, isStale } from "@/lib/geo";
import { Icon } from "./Icon";
import { VenueMap, type Project } from "./VenueMap";

/** The venue header card plus the pin's own height need this much room on top. */
const TOP_CLEARANCE = 130;

/**
 * The live map.
 *
 * - People sharing GPS sit at their real position, labelled with their
 *   distance to the venue (or "last seen …" once the position goes stale).
 * - Everyone else orbits the venue pin by ETA (see orbitOffset).
 * - With a venue location or anyone sharing, the backdrop is a real
 *   OpenStreetMap view framing all of them; otherwise the drawn grid.
 */
export function MapCanvas({
  participants,
  venue,
  lat,
  lng,
  now,
  height = 300,
  children,
}: {
  participants: Participant[];
  venue: string;
  lat: number | null;
  lng: number | null;
  now: number | null;
  height?: number;
  children?: React.ReactNode;
}) {
  const hasVenue = lat !== null && lng !== null;
  const sharers = participants.filter(
    (p) => p.lat !== null && p.lng !== null && p.status !== "arrived",
  );
  const others = participants.filter((p) => !sharers.includes(p));

  // Once anyone shares GPS the map is purely geographic: live dots where they
  // are, arrived friends huddled at the pin (true by definition), and anyone
  // else listed as "not sharing" rather than placed at a made-up distance.
  // With nobody sharing, everyone orbits the venue by ETA instead.
  const geoMode = sharers.length > 0;
  const waiting = geoMode ? others.filter((p) => p.status !== "arrived") : [];
  const orbiters = geoMode ? others.filter((p) => p.status === "arrived") : others;

  const fit: [number, number][] = [
    ...(hasVenue ? [[lat, lng] as [number, number]] : []),
    ...sharers.map((p) => [p.lat!, p.lng!] as [number, number]),
  ];

  const legend = geoMode
    ? waiting.length > 0
      ? null // the "not sharing" strip says it
      : "Dots on the map are live GPS"
    : participants.length > 1
      ? "Closer to the pin = arriving sooner"
      : null;

  return (
    <div
      className="bg-surface-container-high sticker relative isolate w-full overflow-hidden rounded-sticker border-2 border-ink"
      style={{ height }}
    >
      {fit.length > 0 ? (
        <VenueMap
          fit={fit}
          // ETA mode centres the lone venue point with room below for the
          // ring; GPS mode only needs space for the bottom strip.
          padding={{
            top: TOP_CLEARANCE,
            right: 44,
            bottom: geoMode ? 56 : hasVenue && orbiters.length > 0 ? 118 : 44,
            left: 44,
          }}
        >
          {(project) => (
            <LiveOverlay
              project={project}
              venue={venue}
              venuePoint={hasVenue ? { lat, lng } : null}
              sharers={sharers}
              others={orbiters}
              now={now}
              height={height}
            />
          )}
        </VenueMap>
      ) : (
        <DrawnFallback venue={venue} participants={participants} now={now} height={height} />
      )}

      {legend && (
        <span className="bg-surface-container-lowest/90 text-on-surface-variant pointer-events-none absolute bottom-2 left-2 z-[550] rounded-full border border-ink px-2 py-0.5 text-[10px] font-headline">
          {legend}
        </span>
      )}

      {waiting.length > 0 && (
        <div className="bg-surface-container-lowest/95 pointer-events-none absolute bottom-2 left-2 z-[550] flex items-center gap-1.5 rounded-full border border-ink py-0.5 pr-2 pl-0.5">
          <div className="flex -space-x-1.5">
            {waiting.slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-ink text-[9px] font-headline text-ink"
                style={{ backgroundColor: p.tint }}
              >
                {initials(p.name)}
              </span>
            ))}
          </div>
          <span className="text-on-surface-variant text-[10px] font-headline">
            {waiting.length > 5 ? `+${waiting.length - 5} ` : ""}not sharing location
          </span>
        </div>
      )}

      {/* Caller overlays (the venue header card) sit above everything. */}
      <div className="pointer-events-none absolute inset-0 z-[600] [&>*]:pointer-events-auto">
        {children}
      </div>
    </div>
  );
}

/* ── Real map overlay: venue pin, live dots, orbit for the rest ── */

function LiveOverlay({
  project,
  venue,
  venuePoint,
  sharers,
  others,
  now,
  height,
}: {
  project: Project;
  venue: string;
  venuePoint: { lat: number; lng: number } | null;
  sharers: Participant[];
  others: Participant[];
  now: number | null;
  height: number;
}) {
  const v = venuePoint ? project(venuePoint.lat, venuePoint.lng) : null;
  // Room under the venue, minus a badge's half-height and the legend strip.
  const scale = v ? Math.min(1, Math.max(0.25, (height - v.y - 22 - 22) / 95)) : 1;

  return (
    <>
      {v && <VenuePin venue={venue} style={{ left: v.x, top: v.y }} />}

      {/* People without live location orbit the venue by ETA. */}
      {v &&
        others.map((p, i) => {
          const { dx, dy } = orbitOffset(p, i, others.length, now, scale);
          return (
            <Badge
              key={p.id}
              p={p}
              now={now}
              label={orbitLabel(p, now)}
              style={{ left: v.x + dx, top: v.y + dy }}
              transition="duration-[1500ms]"
            />
          );
        })}

      {/* People sharing GPS sit where they actually are. */}
      {sharers.map((p) => {
        const pt = project(p.lat!, p.lng!);
        if (!pt) return null;
        const stale = isStale(p.locatedAt, now);
        const label = stale
          ? `seen ${ago(p.locatedAt!, now)}`
          : venuePoint
            ? formatDistance(distanceM({ lat: p.lat!, lng: p.lng! }, venuePoint))
            : "live";
        return (
          <Badge
            key={p.id}
            p={p}
            now={now}
            label={label}
            live={!stale}
            dim={stale}
            style={{ left: pt.x, top: pt.y }}
            transition="duration-300"
          />
        );
      })}
    </>
  );
}

function orbitLabel(p: Participant, now: number | null): string | null {
  const status = liveStatus(p, now);
  if (status === "late") return "Late";
  const eta = etaMinutes(p, now);
  if (status === "moving" && eta !== null) return eta > 0 ? `${eta} min` : "now";
  return null;
}

function VenuePin({ venue, style }: { venue: string; style: React.CSSProperties }) {
  return (
    <div
      className="absolute z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={style}
    >
      <div className="bg-primary text-on-primary sticker-sm mb-1 max-w-[160px] truncate rounded-lg border-2 border-ink px-2 py-0.5 text-[11px] font-headline whitespace-nowrap">
        📍 {venue}
      </div>
      <div className="bg-primary-container text-on-primary sticker-sm flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink ring-4 ring-white/80">
        <Icon name="celebration" size={16} />
      </div>
    </div>
  );
}

function Badge({
  p,
  now,
  label,
  live = false,
  dim = false,
  style,
  transition,
}: {
  p: Participant;
  now: number | null;
  label: string | null;
  live?: boolean;
  dim?: boolean;
  style: React.CSSProperties;
  transition: string;
}) {
  const status = liveStatus(p, now);
  return (
    <div
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] ease-out ${transition}`}
      style={style}
    >
      <div
        className={`flex flex-col items-center ${dim || status === "idle" ? "opacity-70" : ""}`}
      >
        {label && (
          <span
            className={`sticker-xs mb-0.5 rounded-md border border-ink px-1.5 py-0.5 text-[9px] font-headline whitespace-nowrap ${
              label === "Late"
                ? "bg-error text-on-error"
                : "bg-surface-container-lowest text-on-surface"
            }`}
          >
            {label}
          </span>
        )}
        <div
          className="sticker-sm relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-label-md font-headline text-ink"
          style={{ backgroundColor: p.tint }}
        >
          {live && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--color-status-moving)] opacity-40" />
          )}
          {initials(p.name)}
          <span
            className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border border-ink"
            style={{ backgroundColor: STATUS_META[status].dot }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── No real location anywhere: the drawn grid with the ETA orbit ── */

function DrawnFallback({
  venue,
  participants,
  now,
  height,
}: {
  venue: string;
  participants: Participant[];
  now: number | null;
  height: number;
}) {
  // Push the venue below centre on short maps so the header card can't
  // cover it, then shrink the orbit to the room left underneath.
  const offsetY = Math.max(0, TOP_CLEARANCE - height / 2);
  const roomBelow = height - (height / 2 + offsetY) - 22;
  const scale = Math.min(1, Math.max(0.25, roomBelow / 95));

  return (
    <>
      <StreetGrid />
      <div className="pointer-events-none absolute inset-0 z-[500]">
        <VenuePin venue={venue} style={{ left: "50%", top: `calc(50% + ${offsetY}px)` }} />
        {participants.map((p, i) => {
          const { dx, dy } = orbitOffset(p, i, participants.length, now, scale);
          return (
            <Badge
              key={p.id}
              p={p}
              now={now}
              label={orbitLabel(p, now)}
              style={{ left: `calc(50% + ${dx}px)`, top: `calc(50% + ${offsetY + dy}px)` }}
              transition="duration-[1500ms]"
            />
          );
        })}
      </div>
    </>
  );
}

/** Warm, abstract street grid for rooms without a real location. */
export function StreetGrid() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 300"
    >
      <rect width="400" height="300" fill="#efe9e0" />
      <rect x="18" y="200" width="104" height="80" rx="10" fill="#dbe7d4" />
      <rect x="300" y="24" width="86" height="64" rx="10" fill="#dbe7d4" />
      <path d="M-10 268 Q 90 240 190 272 T 410 252 L410 310 L-10 310 Z" fill="#cfe0ea" />
      <g fill="#e4dcd1">
        <rect x="150" y="34" width="120" height="86" rx="6" />
        <rect x="150" y="150" width="120" height="78" rx="6" />
        <rect x="24" y="34" width="100" height="130" rx="6" />
        <rect x="300" y="118" width="86" height="110" rx="6" />
      </g>
      <g stroke="#fbf8f3" strokeLinecap="square">
        <path d="M0 24 H400" strokeWidth="9" />
        <path d="M0 134 H400" strokeWidth="13" />
        <path d="M0 240 H400" strokeWidth="9" />
        <path d="M138 0 V300" strokeWidth="13" />
        <path d="M284 0 V300" strokeWidth="9" />
        <path d="M60 0 V300" strokeWidth="6" />
      </g>
      <path d="M0 134 H400" stroke="#e8c9a0" strokeWidth="1.5" strokeDasharray="10 9" />
      <path d="M138 0 V300" stroke="#e8c9a0" strokeWidth="1.5" strokeDasharray="10 9" />
    </svg>
  );
}
