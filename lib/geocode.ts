/* ───────────────────────────────────────────────────────────────
   Place search over OpenStreetMap data, via Photon (photon.komoot.io).

   Chosen over Nominatim because Photon is built for search-as-you-type
   (Nominatim's usage policy forbids autocomplete) and returns several
   candidates for partial queries. Called straight from the browser:
   Photon sends `Access-Control-Allow-Origin: *`, and the browser's
   Referer identifies the app, as fair use asks.

   Free public instance, so keep it polite: callers debounce, results
   are cached in memory, and nothing searches under 3 characters.
   ─────────────────────────────────────────────────────────────── */

export type Place = {
  /** Short name for the venue field, e.g. "Akshar Business Park". */
  name: string;
  /** Where it is, e.g. "Turbhe, Navi Mumbai". */
  area: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_id?: number;
  };
};

const cache = new Map<string, Place[]>();

function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const name = p.name ?? [p.housenumber, p.street].filter(Boolean).join(" ");
  if (!name) return null;

  // Most specific → least, skipping repeats of the name itself.
  const parts = [p.street, p.district ?? p.locality, p.city ?? p.county, p.state]
    .filter((x): x is string => !!x && x !== name);
  const area = [...new Set(parts)].slice(0, 3).join(", ");

  return { name, area, lat, lng };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  // Gently bias toward India, where this app's groups are; results
  // elsewhere still come back if they match better.
  const url =
    `https://photon.komoot.io/api/?limit=6&lang=en&lat=20.6&lon=78.9&location_bias_scale=0.2` +
    `&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const json = (await res.json()) as { features?: PhotonFeature[] };

  // Photon can return the same place as a node and a way; keep one.
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of json.features ?? []) {
    const place = toPlace(f);
    if (!place) continue;
    const id = `${place.name}|${place.lat.toFixed(4)}|${place.lng.toFixed(4)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push(place);
  }

  cache.set(key, places);
  return places;
}

/** A link that opens the spot in whatever maps app the phone prefers. */
export function directionsUrl(m: {
  venue: string;
  area: string;
  venueLat: number | null;
  venueLng: number | null;
}): string {
  const query =
    m.venueLat !== null && m.venueLng !== null
      ? `${m.venueLat},${m.venueLng}`
      : `${m.venue}, ${m.area}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
