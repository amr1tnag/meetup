"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

/** Put the venue `offsetY` px below centre: aim the centre that far above it. */
function centreOn(m: LeafletMap, lat: number, lng: number, zoom: number, offsetY: number) {
  const venuePx = m.project([lat, lng], zoom);
  m.setView(m.unproject(venuePx.subtract([0, offsetY]), zoom), zoom, { animate: false });
}

/**
 * A real OpenStreetMap backdrop centred on the venue.
 *
 * Deliberately non-interactive: it shows *where* the spot is, and the
 * venue pin and friend badges are drawn on top by the caller, centred
 * over the same point. "Open maps" is the way to actually navigate.
 *
 * Leaflet reads `window` on import, so it loads inside an effect and
 * never runs during server rendering or the prerender.
 */
export function VenueMap({
  lat,
  lng,
  zoom = 16,
  offsetY = 0,
  className = "",
}: {
  lat: number;
  lng: number;
  zoom?: number;
  /**
   * Show the venue this many px below the map's centre, so a header card
   * over the top of the map doesn't cover it. Overlays drawn by the caller
   * must use the same offset.
   */
  offsetY?: number;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, {
        center: [lat, lng],
        zoom,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      });
      m.attributionControl.setPrefix(false);
      centreOn(m, lat, lng, zoom, offsetY);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      })
        .on("load", () => {
          if (!cancelled) setReady(true);
        })
        .addTo(m);

      map.current = m;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Recentring is handled below; the map itself is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow a new venue (the create screen changes it as you pick).
  useEffect(() => {
    if (map.current) centreOn(map.current, lat, lng, zoom, offsetY);
  }, [lat, lng, zoom, offsetY]);

  return (
    <div className={`venue-map absolute inset-0 ${className}`}>
      <div ref={el} className="h-full w-full" />
      {!ready && (
        <div className="bg-surface-container text-on-surface-variant absolute inset-0 flex items-center justify-center text-label-md font-headline">
          Loading map…
        </div>
      )}
    </div>
  );
}
