"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Map as LeafletMap } from "leaflet";

export type Project = (lat: number, lng: number) => { x: number; y: number } | null;

type Padding = { top: number; right: number; bottom: number; left: number };
type FitSpec = { fit: [number, number][]; padding: Padding; maxZoom: number };

/** Frame all points inside the padding; a single point gets `maxZoom`. */
function frame(m: LeafletMap, spec: FitSpec, animate: boolean) {
  if (spec.fit.length === 0) return;
  const p = spec.padding;
  m.fitBounds(spec.fit, {
    paddingTopLeft: [p.left, p.top],
    paddingBottomRight: [p.right, p.bottom],
    maxZoom: spec.maxZoom,
    animate,
  });
}

/**
 * A real OpenStreetMap backdrop that frames a set of points — the venue,
 * plus anyone sharing live location — inside the given padding.
 *
 * Non-interactive on purpose: it shows *where*, and "Open maps" is for
 * navigating. Callers draw their own pins in React via `children(project)`,
 * which turns a lat/lng into a pixel position on this map and re-renders as
 * the view changes.
 *
 * Leaflet reads `window` on import, so it loads inside an effect and never
 * runs during server rendering or the prerender.
 */
export function VenueMap({
  fit,
  padding = { top: 24, right: 24, bottom: 24, left: 24 },
  maxZoom = 16,
  children,
}: {
  fit: [number, number][];
  padding?: Padding;
  maxZoom?: number;
  children?: (project: Project) => ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  // In state, not a ref: render needs it to project overlay positions.
  const [lmap, setLmap] = useState<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const [, setViewTick] = useState(0);

  // Only refit when the points or padding actually change.
  const fitKey = useMemo(
    () =>
      fit.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join("|") +
      `|${padding.top},${padding.right},${padding.bottom},${padding.left},${maxZoom}`,
    [fit, padding.top, padding.right, padding.bottom, padding.left, maxZoom],
  );
  const specRef = useRef<FitSpec>({ fit, padding, maxZoom });
  useEffect(() => {
    specRef.current = { fit, padding, maxZoom };
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let created: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;

      const spec = specRef.current;
      const m = L.map(el.current, {
        center: spec.fit[0] ?? [20.6, 78.9],
        zoom: spec.maxZoom,
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

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      })
        .on("load", () => {
          if (!cancelled) setReady(true);
        })
        .addTo(m);

      // Re-render overlays whenever the view moves, including mid-animation.
      m.on("move zoom resize", () => setViewTick((t) => t + 1));

      frame(m, spec, false);
      created = m;
      setLmap(m);
    })();

    return () => {
      cancelled = true;
      created?.remove();
      setLmap(null);
    };
  }, []);

  // Reframe when someone moves, joins or stops sharing.
  useEffect(() => {
    if (lmap) frame(lmap, specRef.current, true);
  }, [fitKey, lmap]);

  const project: Project = (lat, lng) => {
    if (!lmap) return null;
    const pt = lmap.latLngToContainerPoint([lat, lng]);
    return { x: pt.x, y: pt.y };
  };

  return (
    <div className="venue-map absolute inset-0">
      <div ref={el} className="h-full w-full" />
      {!ready && (
        <div className="bg-surface-container text-on-surface-variant absolute inset-0 flex items-center justify-center text-label-md font-headline">
          Loading map…
        </div>
      )}
      {lmap && children && (
        <div className="pointer-events-none absolute inset-0 z-[500]">{children(project)}</div>
      )}
    </div>
  );
}
