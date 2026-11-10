"use client";

import {
  STATUS_META,
  type Participant,
  etaMinutes,
  initials,
  liveStatus,
  orbitOffset,
} from "@/lib/types";
import { Icon } from "./Icon";
import { VenueMap } from "./VenueMap";

/**
 * The live map: a real OpenStreetMap view of the venue when the room has
 * coordinates, or the drawn street grid when it doesn't (older rooms, or a
 * venue typed without picking a search result).
 *
 * Friends are not plotted at street positions — nobody shares GPS. They
 * orbit the venue pin, closer the sooner they'll arrive (see orbitOffset).
 */
export function MapCanvas({
  participants,
  venue,
  lat,
  lng,
  now,
  height = 288,
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
  const hasCoords = lat !== null && lng !== null;

  // The venue header card covers the top ~72px and the pin stands ~52px tall,
  // so the venue point must sit at least ~130px down. On short maps, push it
  // below centre (the real map shifts with it), then shrink the orbit to the
  // room left underneath.
  const offsetY = Math.max(0, 130 - height / 2);
  const roomBelow = height - (height / 2 + offsetY) - 22;
  const scale = Math.min(1, Math.max(0.25, roomBelow / 95));
  const anchorTop = `calc(50% + ${offsetY}px)`;

  return (
    <div
      className="bg-surface-container-high sticker relative isolate w-full overflow-hidden rounded-sticker border-2 border-ink"
      style={{ height }}
    >
      {hasCoords ? <VenueMap lat={lat} lng={lng} offsetY={offsetY} /> : <StreetGrid />}

      {/* Everything below is centred on the venue point. Leaflet's panes sit
          at z-index 400+, so the overlay layer goes above them. */}
      <div className="pointer-events-none absolute inset-0 z-[500]">
        {/* Venue pin */}
        <div
          className="absolute left-1/2 z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center"
          style={{ top: anchorTop }}
        >
          <div className="bg-primary text-on-primary sticker-sm mb-1 max-w-[160px] truncate rounded-lg border-2 border-ink px-2 py-0.5 text-[11px] font-headline whitespace-nowrap">
            📍 {venue}
          </div>
          <div className="bg-primary-container text-on-primary sticker-sm flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink ring-4 ring-white/80">
            <Icon name="celebration" size={16} />
          </div>
        </div>

        {/* Friends in orbit */}
        {participants.map((p, i) => {
          const { dx, dy } = orbitOffset(p, i, participants.length, now, scale);
          const status = liveStatus(p, now);
          const eta = etaMinutes(p, now);

          return (
            <div
              key={p.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[1500ms] ease-out"
              style={{ left: `calc(50% + ${dx}px)`, top: `calc(50% + ${offsetY + dy}px)` }}
            >
              <div className={`flex flex-col items-center ${status === "idle" ? "opacity-75" : ""}`}>
                {status === "late" ? (
                  <span className="bg-error text-on-error sticker-xs mb-0.5 rounded-md border border-ink px-1.5 py-0.5 text-[9px] font-headline whitespace-nowrap">
                    Late
                  </span>
                ) : status === "moving" && eta !== null ? (
                  <span className="bg-surface-container-lowest text-on-surface sticker-xs mb-0.5 rounded-md border border-ink px-1.5 py-0.5 text-[9px] font-headline whitespace-nowrap">
                    {eta > 0 ? `${eta} min` : "now"}
                  </span>
                ) : null}

                <div
                  className="sticker-sm relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-label-md font-headline text-ink"
                  style={{ backgroundColor: p.tint }}
                >
                  {initials(p.name)}
                  <span
                    className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border border-ink"
                    style={{ backgroundColor: STATUS_META[status].dot }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {participants.length > 1 && (
          <span className="bg-surface-container-lowest/90 text-on-surface-variant absolute bottom-2 left-2 rounded-full border border-ink px-2 py-0.5 text-[10px] font-headline">
            Closer to the pin = arriving sooner
          </span>
        )}
      </div>

      {/* Caller overlays (the venue header card) sit above everything. */}
      <div className="pointer-events-none absolute inset-0 z-[600] [&>*]:pointer-events-auto">
        {children}
      </div>
    </div>
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
