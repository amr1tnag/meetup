"use client";

import {
  STATUS_META,
  type Participant,
  etaMinutes,
  initials,
  liveStatus,
  pinPosition,
} from "@/lib/types";
import { Icon } from "./Icon";

/**
 * A self-contained stylised map.
 *
 * The Stitch export pointed at expiring Google-hosted static map tiles, so the
 * backdrop is drawn locally instead. Pins are *estimated*: each person glides
 * from their start toward the venue across the ETA they reported. Swap
 * `pinPosition` for real coordinates when GPS sharing lands.
 */
export function MapCanvas({
  participants,
  venue,
  now,
  height = 288,
  children,
}: {
  participants: Participant[];
  venue: string;
  now: number | null;
  height?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="bg-surface-container-high sticker relative w-full overflow-hidden rounded-sticker border-2 border-ink"
      style={{ height }}
    >
      <StreetGrid />

      {/* Destination pin */}
      <div className="pointer-events-none absolute top-[48%] left-[52%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div className="bg-primary text-on-primary sticker-sm mb-1 rounded-lg border-2 border-ink px-2 py-0.5 text-[11px] font-headline whitespace-nowrap">
          📍 {venue}
        </div>
        <div className="bg-primary-container text-on-primary sticker-sm flex h-7 w-7 animate-pulse items-center justify-center rounded-full border-2 border-ink ring-4 ring-white/80">
          <Icon name="celebration" size={16} />
        </div>
      </div>

      {/* Friend markers */}
      {participants.map((p) => {
        const pos = pinPosition(p, now);
        const status = liveStatus(p, now);
        const eta = etaMinutes(p, now);

        return (
          <div
            key={p.id}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-[1500ms] ease-out"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="flex flex-col items-center">
              {status === "late" ? (
                <span className="bg-error text-on-error sticker-xs mb-0.5 rounded-md border border-ink px-1.5 py-0.5 text-[9px] font-headline whitespace-nowrap">
                  Late
                </span>
              ) : eta !== null && eta > 0 ? (
                <span className="bg-surface-container-lowest text-on-surface sticker-xs mb-0.5 rounded-md border border-ink px-1.5 py-0.5 text-[9px] font-headline whitespace-nowrap">
                  {eta} min
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

      {children}

      <span className="bg-surface-container-lowest/90 text-on-surface-variant absolute bottom-3 left-3 z-30 rounded-full border border-ink px-2 py-0.5 text-[10px] font-headline">
        Estimated from ETAs
      </span>
    </div>
  );
}

/** Warm, abstract street grid — no external tiles, no expiry. */
function StreetGrid() {
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
