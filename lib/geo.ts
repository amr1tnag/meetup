/* ───────────────────────────────────────────────────────────────
   Distance, travel time and freshness for live GPS positions.
   ─────────────────────────────────────────────────────────────── */

export type LatLng = { lat: number; lng: number };

/** Within this many metres of the venue counts as arrived. */
export const ARRIVE_RADIUS_M = 80;
/** Moving this far from where sharing started counts as having left. */
export const LEAVE_RADIUS_M = 150;
/** A position older than this is shown as "last seen", not live. */
export const STALE_AFTER_MS = 2 * 60_000;

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/**
 * Rough minutes to cover `m` metres. Uses the phone's reported speed when
 * it's clearly travelling, otherwise ~20 km/h — a fair city average across
 * walking, autos and traffic. It's an estimate and the UI says so ("~").
 */
export function travelMinutes(m: number, speedMps: number | null): number {
  const v = speedMps !== null && speedMps > 1.5 ? Math.max(speedMps, 3) : 5.5;
  return Math.max(1, Math.round(m / v / 60));
}

export function isStale(locatedAt: string | null, nowMs: number | null): boolean {
  if (!locatedAt || nowMs === null) return false;
  return nowMs - new Date(locatedAt).getTime() > STALE_AFTER_MS;
}

export function ago(iso: string, nowMs: number | null): string {
  if (nowMs === null) return "just now";
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}
