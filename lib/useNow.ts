"use client";

import { useSyncExternalStore } from "react";

/* ───────────────────────────────────────────────────────────────
   The wall clock treated as an external system.

   Next's Cache Components prerender rejects `Date.now()` read during
   render — and a prerendered countdown would be baked in anyway. So the
   clock lives outside React: one shared interval publishes ticks, and
   components subscribe to it.
   ─────────────────────────────────────────────────────────────── */

const TICK_MS = 10_000;

let current: number | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function startClock() {
  if (timer !== undefined) return;
  current = Date.now();
  timer = window.setInterval(() => {
    current = Date.now();
    for (const l of listeners) l();
  }, TICK_MS);
}

function subscribe(onChange: () => void) {
  const first = listeners.size === 0;
  listeners.add(onChange);

  if (first) {
    startClock();
    // Publish the initial reading to everyone now mounted.
    onChange();
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
      current = null;
    }
  };
}

/**
 * Current time in ms, or `null` on the server and the first client render.
 * Ticks every 10s so countdowns and pins stay honest.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/* ── window.location.origin, same treatment ─────────────────── */

function subscribeNever() {
  return () => {};
}

/** The page origin, or `""` before hydration. Needed to build invite links. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
}
