/** Live status semantics from the Stitch design system. */
export type Status = "idle" | "moving" | "arrived" | "late";

export const STATUS_META: Record<
  Status,
  { label: string; color: string; onColor: string; dot: string }
> = {
  idle: {
    label: "Not left yet",
    color: "var(--color-status-idle)",
    onColor: "#ffffff",
    dot: "var(--color-status-idle)",
  },
  moving: {
    label: "On the way",
    color: "var(--color-status-moving)",
    onColor: "#141414",
    dot: "var(--color-status-moving)",
  },
  arrived: {
    label: "Arrived",
    color: "var(--color-status-arrived)",
    onColor: "#ffffff",
    dot: "var(--color-status-arrived)",
  },
  late: {
    label: "Running late",
    color: "var(--color-status-late)",
    onColor: "#ffffff",
    dot: "var(--color-status-late)",
  },
};

/** The five avatar tints offered on the join screen. */
export const TINTS = [
  { name: "Coral", value: "#FFB59E" },
  { name: "Lavender", value: "#D1C4E9" },
  { name: "Yellow", value: "#FFE082" },
  { name: "Mint", value: "#A7F3D0" },
  { name: "Sky", value: "#93C5FD" },
] as const;

/* ── Domain shapes (camelCase mirrors of the Postgres rows) ───── */

export type Meetup = {
  id: string;
  code: string;
  title: string;
  venue: string;
  area: string;
  whenLabel: string;
  startsAt: string;
  createdAt: string;
  /** Real venue location, when the host picked a search result. */
  venueLat: number | null;
  venueLng: number | null;
};

export type Participant = {
  id: string;
  meetupId: string;
  userId: string;
  name: string;
  tint: string;
  isHost: boolean;
  status: Status;
  note: string;
  leftAt: string | null;
  etaAt: string | null;
  arrivedAt: string | null;
  startX: number;
  startY: number;
  joinedAt: string;
};

export type Nudge = {
  id: number;
  meetupId: string;
  fromParticipant: string;
  toParticipant: string;
  createdAt: string;
};

/** What the invite screen can see before you've joined. */
export type PreviewPerson = {
  name: string;
  tint: string;
  status: Status;
  isHost: boolean;
};

/* ── Row mappers ──────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw PostgREST rows */
export function toMeetup(r: any): Meetup {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    venue: r.venue,
    area: r.area,
    whenLabel: r.when_label,
    startsAt: r.starts_at,
    createdAt: r.created_at,
    venueLat: r.venue_lat ?? null,
    venueLng: r.venue_lng ?? null,
  };
}

export function toParticipant(r: any): Participant {
  return {
    id: r.id,
    meetupId: r.meetup_id,
    userId: r.user_id,
    name: r.name,
    tint: r.tint,
    isHost: r.is_host,
    status: r.status,
    note: r.note,
    leftAt: r.left_at,
    etaAt: r.eta_at,
    arrivedAt: r.arrived_at,
    startX: Number(r.start_x),
    startY: Number(r.start_y),
    joinedAt: r.joined_at,
  };
}

export function toNudge(r: any): Nudge {
  return {
    id: Number(r.id),
    meetupId: r.meetup_id,
    fromParticipant: r.from_participant,
    toParticipant: r.to_participant,
    createdAt: r.created_at,
  };
}

export function toPreviewPerson(r: any): PreviewPerson {
  return { name: r.name, tint: r.tint, status: r.status, isHost: r.is_host };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Derivations ──────────────────────────────────────────────────
   Nobody streams GPS. People tell the app "I've left, ~15 min", and
   everything live — the countdown, the badge orbiting in toward the
   venue, flipping to "late" once the ETA passes — is derived from
   left_at and eta_at against the current clock.                    */

/**
 * Whole minutes left until this person's ETA, or null if unknown.
 * Rounds rather than ceils: the shared clock can lag by a tick, and
 * ceil turned a fresh "10 min" pick into "11 min away".
 */
export function etaMinutes(p: Participant, nowMs: number | null): number | null {
  if (p.status === "arrived") return 0;
  if (!p.etaAt || nowMs === null) return null;
  return Math.max(0, Math.round((new Date(p.etaAt).getTime() - nowMs) / 60_000));
}

/** Status as it should read right now: in transit past the ETA is late. */
export function liveStatus(p: Participant, nowMs: number | null): Status {
  if (
    p.status === "moving" &&
    p.etaAt &&
    nowMs !== null &&
    nowMs > new Date(p.etaAt).getTime() + 60_000
  ) {
    return "late";
  }
  return p.status;
}

/**
 * Where a friend's badge sits around the venue pin, as a pixel offset
 * from it. Distance encodes time, not geography: arrived friends huddle
 * at the pin, people en route sit further out the longer their ETA, and
 * anyone who hasn't left waits on the outer ring. As a countdown runs
 * down the badge glides inward. Positions are spread across the lower
 * arc so the venue header card at the top of the map stays clear.
 */
export function orbitOffset(
  p: Participant,
  index: number,
  count: number,
  nowMs: number | null,
  /** Shrinks the whole orbit to fit shorter maps. */
  scale = 1,
): { dx: number; dy: number } {
  const status = liveStatus(p, nowMs);
  const eta = etaMinutes(p, nowMs);

  let r: number;
  if (status === "arrived") r = 34;
  else if (status === "idle" || eta === null) r = 118;
  else r = 50 + Math.min(eta, 25) * 2.6; // 50px at the door … 115px at 25+ min

  const deg = count <= 1 ? 90 : -20 + (index * 220) / (count - 1);
  const rad = (deg * Math.PI) / 180;
  return { dx: Math.cos(rad) * r * 1.25 * scale, dy: Math.sin(rad) * r * 0.8 * scale };
}

/* ── Formatting ───────────────────────────────────────────────── */

export function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

/** Minutes from `nowMs` until `iso`. Pass the clock in so callers stay pure. */
export function minutesUntil(iso: string, nowMs: number): number {
  return Math.round((new Date(iso).getTime() - nowMs) / 60000);
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
