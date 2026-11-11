"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, friendlyError, getSupabase } from "./supabase";
import {
  type Meetup,
  type Nudge,
  type Participant,
  type PreviewPerson,
  toMeetup,
  toNudge,
  toParticipant,
  toPreviewPerson,
} from "./types";

/* ───────────────────────────────────────────────────────────────
   A meetup room as seen by this browser.

   Members get the full roster plus a Realtime subscription; anyone
   else holding the code gets the read-only invite preview. RLS on the
   server is what decides which of the two you are.
   ─────────────────────────────────────────────────────────────── */

export type RoomState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "preview"; meetup: Meetup; roster: PreviewPerson[] }
  | {
      kind: "member";
      meetup: Meetup;
      participants: Participant[];
      nudges: Nudge[];
      me: Participant;
    };

type Member = Extract<RoomState, { kind: "member" }>;

function upsert(list: Participant[], p: Participant): Participant[] {
  const i = list.findIndex((x) => x.id === p.id);
  if (i === -1) {
    return [...list, p].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }
  const next = list.slice();
  next[i] = p;
  return next;
}

export function useRoom(
  code: string,
  opts: { onNudged?: (from: Participant) => void } = {},
) {
  const [state, setState] = useState<{ code: string; room: RoomState }>({
    code,
    room: { kind: "loading" },
  });
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the latest callback and state without resubscribing on every render.
  const onNudgedRef = useRef(opts.onNudged);
  const latestRef = useRef<RoomState>({ kind: "loading" });
  useEffect(() => {
    onNudgedRef.current = opts.onNudged;
  });

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();
    let channel: ReturnType<typeof sb.channel> | null = null;

    const set = (room: RoomState) => {
      if (!cancelled) setState({ code, room });
    };

    /** Apply a change to the member view, if we're showing one. */
    const patch = (fn: (m: Member) => Member) => {
      if (cancelled) return;
      setState((prev) => {
        if (prev.code !== code || prev.room.kind !== "member") return prev;
        return { code, room: fn(prev.room) };
      });
    };

    (async () => {
      try {
        const uid = await ensureSession();

        // RLS only returns the room if we're in it.
        const { data: row, error } = await sb
          .from("meetups")
          .select("*")
          .eq("code", code)
          .maybeSingle();
        if (error) throw error;

        if (!row) {
          const { data: preview, error: pErr } = await sb.rpc("get_meetup_preview", {
            p_code: code,
          });
          if (pErr) throw pErr;
          if (!preview) return set({ kind: "missing" });
          return set({
            kind: "preview",
            meetup: toMeetup(preview.meetup),
            roster: (preview.participants ?? []).map(toPreviewPerson),
          });
        }

        // Unmounted while we were awaiting — don't open a channel nobody
        // will ever clean up.
        if (cancelled) return;

        const meetup = toMeetup(row);
        const filter = `meetup_id=eq.${meetup.id}`;

        // Subscribe *before* the initial fetch, and wait until the server
        // confirms the subscription is streaming. Anything that changes
        // after that point arrives as an event, so nothing falls through
        // the gap between "fetched" and "listening".
        //
        // The topic is unique per hook instance: supabase-js hands back an
        // existing channel when the topic matches, so a page that mounts
        // while the previous page's channel is still tearing down would get
        // an already-subscribed channel and `.on()` would throw.
        await new Promise<void>((resolve, reject) => {
          channel = sb
            .channel(`room:${meetup.id}:${crypto.randomUUID()}`, {
              config: { postgres_changes_options: { wait: true } },
            })
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "participants", filter },
              (payload) => {
                if (payload.eventType === "DELETE") {
                  const id = (payload.old as { id?: string }).id;
                  patch((m) => ({
                    ...m,
                    participants: m.participants.filter((p) => p.id !== id),
                  }));
                  return;
                }
                const p = toParticipant(payload.new);
                patch((m) => ({
                  ...m,
                  participants: upsert(m.participants, p),
                  me: p.id === m.me.id ? p : m.me,
                }));
              },
            )
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "nudges", filter },
              (payload) => {
                const n = toNudge(payload.new);

                // Read who/whom from the last rendered state — a setState
                // updater isn't guaranteed to run before we'd need it.
                const cur = latestRef.current;
                if (cur.kind === "member" && n.toParticipant === cur.me.id) {
                  const from = cur.participants.find((p) => p.id === n.fromParticipant);
                  if (from) onNudgedRef.current?.(from);
                }

                patch((m) =>
                  m.nudges.some((x) => x.id === n.id)
                    ? m
                    : { ...m, nudges: [...m.nudges, n] },
                );
              },
            )
            .subscribe((status, err) => {
              if (status === "SUBSCRIBED") resolve();
              else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                reject(err ?? new Error(`Realtime ${status.toLowerCase()}`));
              }
            });
        });

        // Cleanup may have run while we waited for SUBSCRIBED; it saw the
        // channel then, but close it here too in case it didn't.
        if (cancelled) {
          if (channel) void sb.removeChannel(channel);
          return;
        }

        const [{ data: people, error: e1 }, { data: nudgeRows, error: e2 }] =
          await Promise.all([
            sb.from("participants").select("*").eq("meetup_id", meetup.id).order("joined_at"),
            sb.from("nudges").select("*").eq("meetup_id", meetup.id).order("id"),
          ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (cancelled) return;

        const participants = (people ?? []).map(toParticipant);
        const me = participants.find((p) => p.userId === uid);
        if (!me) return set({ kind: "missing" });

        set({
          kind: "member",
          meetup,
          participants,
          nudges: (nudgeRows ?? []).map(toNudge),
          me,
        });
      } catch (err) {
        set({ kind: "error", message: friendlyError(err) });
      }
    })();

    return () => {
      cancelled = true;
      if (channel) void sb.removeChannel(channel);
    };
  }, [code, reloadKey]);

  const room: RoomState = state.code === code ? state.room : { kind: "loading" };
  useEffect(() => {
    latestRef.current = room;
  });

  /** Merge a row we just wrote, without waiting for its Realtime echo. */
  const applyLocal = useCallback(
    (p: Participant) => {
      setState((prev) => {
        if (prev.code !== code || prev.room.kind !== "member") return prev;
        const m = prev.room;
        return {
          code,
          room: { ...m, participants: upsert(m.participants, p), me: p.id === m.me.id ? p : m.me },
        };
      });
    },
    [code],
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { room, applyLocal, reload };
}

/* ── Rooms this browser belongs to (for the home screen) ─────── */

export function useMyRooms() {
  const [rooms, setRooms] = useState<Meetup[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const { data, error } = await getSupabase()
          .from("meetups")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        if (!cancelled) setRooms((data ?? []).map(toMeetup));
      } catch {
        if (!cancelled) setRooms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return rooms;
}

/* ── Writes ─────────────────────────────────────────────────────── */

export async function createMeetup(input: {
  venue: string;
  area: string;
  whenLabel: string;
  minutesFromNow: number;
  hostName: string;
  /** From a picked search result; both or neither. */
  lat: number | null;
  lng: number | null;
}): Promise<string> {
  await ensureSession();
  const { data, error } = await getSupabase().rpc("create_meetup", {
    p_venue: input.venue,
    p_area: input.area,
    p_when_label: input.whenLabel,
    p_minutes_from_now: input.minutesFromNow,
    p_host_name: input.hostName,
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error) throw new Error(friendlyError(error));
  return data as string;
}

export async function joinMeetup(code: string, name: string, tint: string): Promise<void> {
  await ensureSession();
  const { error } = await getSupabase().rpc("join_meetup", {
    p_code: code,
    p_name: name,
    p_tint: tint,
  });
  if (error) throw new Error(friendlyError(error));
}

type StatusPatch = Partial<{
  status: Participant["status"];
  note: string;
  left_at: string | null;
  eta_at: string | null;
  arrived_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  speed_mps: number | null;
  located_at: string | null;
}>;

async function updateMe(id: string, patch: StatusPatch): Promise<Participant> {
  const { data, error } = await getSupabase()
    .from("participants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(friendlyError(error));
  return toParticipant(data);
}

/** "I've left": start the travel window with a self-reported ETA. */
export function leaveNow(me: Participant, etaMin: number) {
  const now = Date.now();
  return updateMe(me.id, {
    status: "moving",
    left_at: new Date(now).toISOString(),
    eta_at: new Date(now + etaMin * 60_000).toISOString(),
    arrived_at: null,
    note: `ETA ${etaMin} min`,
  });
}

/** "I'm late": push the ETA out and say so. */
export function runLate(me: Participant, extraMin = 10) {
  const base = Math.max(me.etaAt ? new Date(me.etaAt).getTime() : 0, Date.now());
  return updateMe(me.id, {
    status: "late",
    eta_at: new Date(base + extraMin * 60_000).toISOString(),
    note: "held up",
  });
}

export function arriveNow(me: Participant) {
  return updateMe(me.id, {
    status: "arrived",
    arrived_at: new Date().toISOString(),
    note: "at the table",
  });
}

/**
 * Publish my latest GPS fix. `leaving` also flips me to "on the way",
 * which happens automatically once I've moved away from where I started.
 */
export function shareLocation(
  me: Participant,
  fix: { lat: number; lng: number; accuracy: number; speed: number | null; at: number },
  leaving: boolean,
) {
  return updateMe(me.id, {
    lat: fix.lat,
    lng: fix.lng,
    accuracy_m: Math.round(fix.accuracy),
    speed_mps: fix.speed,
    located_at: new Date(fix.at).toISOString(),
    ...(leaving
      ? {
          status: "moving" as const,
          left_at: new Date(fix.at).toISOString(),
          eta_at: null,
          note: "sharing live location",
        }
      : {}),
  });
}

/** Stop sharing: erase my position from the room. */
export function stopSharing(me: Participant) {
  return updateMe(me.id, {
    lat: null,
    lng: null,
    accuracy_m: null,
    speed_mps: null,
    located_at: null,
  });
}

/** Nudge one person, or everyone not yet here. Returns how many. */
export async function sendNudge(meetupId: string, to: string | null): Promise<number> {
  const { data, error } = await getSupabase().rpc("send_nudge", {
    p_meetup: meetupId,
    p_to: to,
  });
  if (error) throw new Error(friendlyError(error));
  return Number(data ?? 0);
}
