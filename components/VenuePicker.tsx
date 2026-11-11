"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { StickerCard } from "./ui";
import { StreetGrid } from "./MapCanvas";
import { VenueMap } from "./VenueMap";
import { type Place, searchPlaces } from "@/lib/geocode";

/** The venue marker, standing on its point. */
export function SpotPin({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: x, top: y }}>
      <div className="bg-primary-container sticker-sm flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink ring-4 ring-white/80">
        <Icon name="location_on" size={16} fill className="text-on-primary" />
      </div>
    </div>
  );
}

/** What the create screen gets back: a place, with or without a location. */
export type Spot = {
  venue: string;
  area: string;
  lat: number | null;
  lng: number | null;
};

type Results = { query: string; places: Place[]; failed: boolean };

/**
 * "The Spot" card: search OpenStreetMap as you type, pick a suggestion,
 * see it on a real map. If search can't find the place, you can still
 * use the typed name — the room just gets the drawn map instead.
 */
export function VenuePicker({
  value,
  onChange,
}: {
  value: Spot | null;
  onChange: (spot: Spot | null) => void;
}) {
  const [query, setQuery] = useState(value?.venue ?? "");
  const [results, setResults] = useState<Results>({ query: "", places: [], failed: false });

  const q = query.trim();
  // Showing a picked place: don't search for its own name again.
  const picked = value !== null && value.venue === q;
  const searchable = q.length >= 3 && !picked;
  const loading = searchable && results.query !== q;

  // Debounced search. All state updates happen in the async callback.
  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const places = await searchPlaces(q, ctrl.signal);
        setResults({ query: q, places, failed: false });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults({ query: q, places: [], failed: true });
        }
      }
    }, 450);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q, searchable]);

  function pick(p: Place) {
    setQuery(p.name);
    onChange({ venue: p.name, area: p.area, lat: p.lat, lng: p.lng });
  }

  function useTyped() {
    onChange({ venue: q, area: "", lat: null, lng: null });
  }

  const showList = searchable && !loading;
  const hasCoords = value?.lat != null && value?.lng != null;

  return (
    <StickerCard className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <label
          htmlFor="venue"
          className="text-on-surface flex items-center gap-1.5 text-label-lg font-headline"
        >
          <Icon name="place" size={18} fill className="text-primary" />
          The Spot
        </label>
        <span className="text-primary bg-primary-fixed/60 rounded-full px-2 py-0.5 text-label-status font-headline uppercase">
          {value ? "Selected" : "Required"}
        </span>
      </div>

      <div className="relative flex items-center">
        <Icon
          name={loading ? "progress_activity" : "search"}
          size={20}
          className={`text-on-surface-variant pointer-events-none absolute left-3.5 ${loading ? "animate-spin" : ""}`}
        />
        <input
          id="venue"
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          placeholder="Search a cafe, mall, area…"
          className="bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:border-primary-container w-full rounded-lg border-2 border-ink py-3 pr-10 pl-10 text-body-lg transition-colors focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear location"
            onClick={() => {
              setQuery("");
              onChange(null);
            }}
            className="bg-secondary-container text-on-secondary-container absolute right-3 flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      {/* Suggestions */}
      {showList && (
        <div className="flex flex-col gap-1.5" role="listbox" aria-label="Places">
          {results.places.map((p) => (
            <button
              key={`${p.name}-${p.lat}-${p.lng}`}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => pick(p)}
              className="bg-surface-container-lowest hover:bg-surface-container-low sticker-xs press flex items-start gap-2 rounded-lg border-2 border-ink px-3 py-2 text-left"
            >
              <Icon name="location_on" size={18} className="text-primary mt-0.5" />
              <span className="min-w-0">
                <span className="text-on-surface block truncate text-label-lg font-headline">
                  {p.name}
                </span>
                {p.area && (
                  <span className="text-on-surface-variant block truncate text-body-sm">
                    {p.area}
                  </span>
                )}
              </span>
            </button>
          ))}

          {results.places.length === 0 && (
            <p className="text-on-surface-variant px-1 text-body-sm">
              {results.failed
                ? "Place search isn't responding right now."
                : "No match. Check the spelling, or add the area — e.g. “Akshar, Turbhe, Navi Mumbai”."}
            </p>
          )}

          <button
            type="button"
            onClick={useTyped}
            className="text-on-surface-variant self-start px-1 text-label-md font-headline underline"
          >
            Use “{q}” without a map
          </button>
        </div>
      )}

      {/* Preview */}
      <div className="bg-surface-container relative isolate h-36 w-full overflow-hidden rounded-lg border-2 border-ink">
        {hasCoords ? (
          <VenueMap
            fit={[[value!.lat!, value!.lng!]]}
            padding={{ top: 40, right: 24, bottom: 24, left: 24 }}
          >
            {(project) => {
              const pt = project(value!.lat!, value!.lng!);
              return pt ? <SpotPin x={pt.x} y={pt.y} /> : null;
            }}
          </VenueMap>
        ) : (
          <StreetGrid />
        )}

        <div className="pointer-events-none absolute inset-0 z-[550]">
          <div className="from-inverse-surface/50 absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t to-transparent p-2.5 pb-5">
            <span className="bg-surface-container-lowest/95 text-on-surface sticker-xs flex min-w-0 items-center gap-1.5 rounded-full border border-ink px-2.5 py-1 text-label-status font-headline">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${hasCoords ? "bg-primary-container animate-ping" : "bg-status-idle"}`}
              />
              <span className="truncate">
                {value
                  ? [value.venue, value.area].filter(Boolean).join(" · ")
                  : "Search above to see it on the map"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </StickerCard>
  );
}
