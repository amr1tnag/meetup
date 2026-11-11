"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { arriveNow, shareLocation, stopSharing } from "./room";
import { ARRIVE_RADIUS_M, LEAVE_RADIUS_M, type LatLng, distanceM } from "./geo";
import type { Participant } from "./types";

/* ───────────────────────────────────────────────────────────────
   Live location sharing for the current viewer.

   Opt-in per room. While on and the page is open, watches GPS and:
     • publishes the position at most every 15 s (sooner after 30 m),
     • marks you "on the way" once you're 150 m from where you started,
     • marks you arrived within ~80 m of the venue — which also makes
       the database erase your position.

   Browsers stop delivering positions to a page in the background, so
   this only runs while the room is open on screen. The optional wake
   lock keeps the screen on to avoid exactly that.
   ─────────────────────────────────────────────────────────────── */

export type Fix = LatLng & { accuracy: number; speed: number | null; at: number };

export type SharingState = "off" | "locating" | "live" | "denied" | "unavailable";

const WRITE_EVERY_MS = 15_000;
const WRITE_AFTER_M = 30;

/* "I chose to share in this room", remembered per browser so a reload
   resumes sharing. Per-viewer convenience, so localStorage is right. */
const flagListeners = new Set<() => void>();
const flagKey = (code: string) => `meetup:share:${code}`;

function readFlag(code: string): boolean {
  try {
    return window.localStorage.getItem(flagKey(code)) === "1";
  } catch {
    return false;
  }
}

function writeFlag(code: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(flagKey(code), "1");
    else window.localStorage.removeItem(flagKey(code));
  } catch {
    /* blocked storage: sharing still works, it just won't resume on reload */
  }
  for (const l of flagListeners) l();
}

function subscribeFlag(cb: () => void) {
  flagListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    flagListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const subscribeNever = () => () => {};

export function useLocationSharing({
  code,
  me,
  venue,
  onWrite,
  onArrived,
}: {
  code: string;
  me: Participant | null;
  venue: LatLng | null;
  /** Called with my updated row after each successful write. */
  onWrite: (p: Participant) => void;
  onArrived: (p: Participant) => void;
}) {
  const enabled = useSyncExternalStore(subscribeFlag, () => readFlag(code), () => false);
  const supported = useSyncExternalStore(
    subscribeNever,
    () => "geolocation" in navigator,
    () => true,
  );
  const wakeLockSupported = useSyncExternalStore(
    subscribeNever,
    () => "wakeLock" in navigator,
    () => false,
  );

  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<"denied" | "unavailable" | null>(null);
  const [keepAwake, setKeepAwake] = useState(true);

  const active = enabled && supported && me !== null && me.status !== "arrived";

  // Latest values for the long-lived watch callback.
  const meRef = useRef(me);
  const venueRef = useRef(venue);
  const onWriteRef = useRef(onWrite);
  const onArrivedRef = useRef(onArrived);
  useEffect(() => {
    meRef.current = me;
    venueRef.current = venue;
    onWriteRef.current = onWrite;
    onArrivedRef.current = onArrived;
  });

  useEffect(() => {
    if (!active) return;

    let origin: Fix | null = null;
    let lastWritten: Fix | null = null;
    let writing = false;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const f: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          at: pos.timestamp,
        };
        setFix(f);
        setError(null);

        const current = meRef.current;
        if (!current || current.status === "arrived" || writing) return;
        origin ??= f;

        // Close enough to the venue? Arrive (the DB then erases the position).
        const v = venueRef.current;
        if (v && distanceM(f, v) - Math.min(f.accuracy, 60) <= ARRIVE_RADIUS_M) {
          writing = true;
          try {
            onArrivedRef.current(await arriveNow(current));
          } catch {
            /* next fix retries */
          } finally {
            writing = false;
          }
          return;
        }

        const leaving =
          current.status === "idle" &&
          f.accuracy <= 100 &&
          distanceM(origin, f) >= LEAVE_RADIUS_M;
        const due =
          !lastWritten ||
          f.at - lastWritten.at >= WRITE_EVERY_MS ||
          distanceM(lastWritten, f) >= WRITE_AFTER_M;
        if (!due && !leaving) return;

        writing = true;
        try {
          onWriteRef.current(await shareLocation(current, f, leaving));
          lastWritten = f;
        } catch {
          /* offline or rejected: the next fix retries */
        } finally {
          writing = false;
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("denied");
          writeFlag(code, false);
        } else {
          setError("unavailable");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [active, code]);

  // Keep the screen on while travelling, so the browser keeps sending GPS.
  useEffect(() => {
    if (!active || !keepAwake || !wakeLockSupported) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (released || document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* low battery mode etc. — sharing still works while the screen is on */
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active, keepAwake, wakeLockSupported]);

  const start = useCallback(() => {
    setError(null);
    writeFlag(code, true);
  }, [code]);

  const stop = useCallback(async () => {
    writeFlag(code, false);
    setFix(null);
    const current = meRef.current;
    if (current && current.lat !== null) {
      try {
        onWriteRef.current(await stopSharing(current));
      } catch {
        /* the 3-hour purge clears it regardless */
      }
    }
  }, [code]);

  let state: SharingState = "off";
  if (error === "denied") state = "denied";
  else if (active) state = error === "unavailable" && !fix ? "unavailable" : fix ? "live" : "locating";

  return {
    supported,
    state,
    sharing: active,
    fix,
    start,
    stop,
    keepAwake,
    setKeepAwake,
    wakeLockSupported,
  };
}
