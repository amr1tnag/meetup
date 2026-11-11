"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader, Shell } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { MapCanvas } from "@/components/MapCanvas";
import { LiveTracker } from "@/components/LiveTracker";
import { WaitingState } from "@/components/WaitingState";
import { EtaSheet } from "@/components/EtaSheet";
import { MeetupGone } from "@/components/MeetupGone";
import { useToast } from "@/components/Toast";
import { GhostButton, PrimaryButton, StickerCard } from "@/components/ui";
import { arriveNow, deleteMeetup, leaveNow, runLate, sendNudge, useRoom } from "@/lib/room";
import { useNow, useOrigin } from "@/lib/useNow";
import { directionsUrl } from "@/lib/geocode";
import { distanceM, formatDistance, travelMinutes } from "@/lib/geo";
import { useLocationSharing } from "@/lib/useLocationSharing";
import { type Participant, liveStatus, minutesUntil } from "@/lib/types";

export default function LiveMeetupPage() {
  // useParams is runtime-only, so it needs a boundary to stream into.
  return (
    <Suspense fallback={<RadarLoading />}>
      <LiveMeetupScreen />
    </Suspense>
  );
}

function RadarLoading() {
  return (
    <>
      <AppHeader />
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
          <Icon name="sensors" size={28} className="text-primary animate-pulse" />
          <p className="text-on-surface-variant text-label-md font-headline">
            Tuning the radar…
          </p>
        </div>
      </Shell>
    </>
  );
}

function LiveMeetupScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const origin = useOrigin();
  const inviteUrl = `${origin}/j/${code}`;

  const { room, applyLocal, reload } = useRoom(code, {
    onNudged: (from) => {
      toast(`${from.name} nudged you — move it! 🔔`, "notifications_active");
      navigator.vibrate?.(200);
    },
  });

  const [etaOpen, setEtaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const member = room.kind === "member" ? room : null;
  const venuePoint =
    member && member.meetup.venueLat !== null && member.meetup.venueLng !== null
      ? { lat: member.meetup.venueLat, lng: member.meetup.venueLng }
      : null;

  const location = useLocationSharing({
    code,
    me: member?.me ?? null,
    venue: venuePoint,
    onWrite: applyLocal,
    onArrived: (p) => {
      applyLocal(p);
      toast("You've arrived — your location was erased 🎊", "celebration");
    },
  });

  // Someone with the link who hasn't joined yet belongs on the invite screen.
  useEffect(() => {
    if (room.kind === "preview") router.replace(`/j/${code}`);
  }, [room.kind, code, router]);

  const nudgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (room.kind === "member") {
      for (const n of room.nudges) counts[n.toParticipant] = (counts[n.toParticipant] ?? 0) + 1;
    }
    return counts;
  }, [room]);

  if (room.kind === "loading" || room.kind === "preview") return <RadarLoading />;

  if (room.kind === "error") {
    return (
      <>
        <AppHeader context="Offline" />
        <Shell>
          <StickerCard className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
            <span className="text-headline-lg">📡</span>
            <h1 className="text-headline-md font-headline">Lost the signal</h1>
            <p className="text-on-surface-variant text-body-md">{room.message}</p>
            <PrimaryButton onClick={reload}>Try again</PrimaryButton>
          </StickerCard>
        </Shell>
      </>
    );
  }

  if (room.kind === "missing" || room.kind === "ended") {
    return <MeetupGone code={code} ended={room.kind === "ended"} />;
  }

  const { meetup, participants, me } = room;
  const startsIn = now === null ? null : minutesUntil(meetup.startsAt, now);
  const soloRoom = participants.length < 2;
  const everyoneHere = participants.every((p) => p.status === "arrived");
  const myStatus = liveStatus(me, now);

  async function share() {
    const text = `${me.name} is heading to ${meetup.venue} — tap to share your ETA:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Meet up @ ${meetup.venue}`, text, url: inviteUrl });
        return;
      } catch {
        /* dismissed — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast("Invite link copied! 📋", "link");
    } catch {
      toast("Copy the link from the address bar", "link");
    }
  }

  /** Run a status write, merging the result before its Realtime echo lands. */
  async function write(fn: () => Promise<Participant>, ok: string, icon: string) {
    setBusy(true);
    try {
      applyLocal(await fn());
      toast(ok, icon);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update your status", "error");
    } finally {
      setBusy(false);
    }
  }

  async function nudge(target: Participant | null) {
    try {
      const n = await sendNudge(meetup.id, target?.id ?? null);
      toast(
        n === 0
          ? "Everyone's already here 🎉"
          : target
            ? `Poked ${target.name} with a loud ring! 🔔`
            : `Nudged ${n} ${n === 1 ? "person" : "people"}! 📢`,
        "campaign",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Nudge didn't send", "error");
    }
  }

  // GPS is the default way to show progress; an ETA is the fallback for
  // browsers without geolocation or people who'd rather not share.
  const gpsAvailable = location.supported && location.state !== "denied";
  const offerGps = me.status === "idle" && !location.sharing && gpsAvailable;

  function primaryAction() {
    if (busy) return;
    if (me.status === "arrived") {
      toast("You're already at the table 🍻", "check_circle");
    } else if (me.status === "idle" && !location.sharing) {
      if (gpsAvailable) location.start();
      else setEtaOpen(true);
    } else {
      void write(() => arriveNow(me), `You arrived at ${meetup.venue} 🎊`, "celebration");
    }
  }

  const cta =
    me.status === "arrived"
      ? { label: "You're at the table! 🍻", icon: "check_circle", color: "var(--color-status-arrived)" }
      : offerGps
        ? { label: "Share my live location", icon: "my_location", color: "var(--color-primary-container)" }
        : me.status === "idle" && !location.sharing
          ? { label: "I've left the house!", icon: "directions_run", color: "var(--color-primary-container)" }
          : { label: "I've arrived! 🎉", icon: "sports_score", color: "var(--color-primary-container)" };

  const myDistance =
    location.fix && venuePoint ? distanceM(location.fix, venuePoint) : null;

  return (
    <>
      <AppHeader context="Active Meetup" />
      <Shell>
        <div className="flex w-full flex-col gap-space-md pb-64">
          {/* ── Utility bar ──────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2 py-space-sm">
            <span className="bg-surface-container sticker-sm flex items-center gap-space-xs rounded-full border-2 border-ink px-3 py-1.5">
              <span className="bg-primary-container h-2.5 w-2.5 animate-ping rounded-full" />
              <span className="text-on-surface text-label-status font-headline uppercase">
                Room live
              </span>
            </span>

            <div className="flex items-center gap-space-sm">
              {!soloRoom && (
                <GhostButton onClick={() => nudge(null)} className="min-h-[36px] py-1.5">
                  <Icon name="notifications_active" size={18} fill className="text-primary" />
                  Nudge all
                </GhostButton>
              )}
              <GhostButton onClick={share} className="min-h-[36px] w-9 px-0 py-1.5">
                <Icon name="ios_share" size={19} />
                <span className="sr-only">Share meetup link</span>
              </GhostButton>
              {me.isHost && (
                <GhostButton
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-[36px] w-9 px-0 py-1.5"
                >
                  <Icon name="delete" size={19} className="text-error" />
                  <span className="sr-only">Delete meetup</span>
                </GhostButton>
              )}
            </div>
          </div>

          {/* ── Map ──────────────────────────────────────────── */}
          <MapCanvas
            participants={participants}
            venue={meetup.venue}
            lat={meetup.venueLat}
            lng={meetup.venueLng}
            now={now}
            height={soloRoom ? 200 : 300}
          >
            <div
              className="bg-surface-container-lowest sticker absolute top-3 right-3 left-3 z-30 flex items-center justify-between gap-2 rounded-2xl border-2 border-ink px-3 py-2"
              style={{ transform: "rotate(-1deg)" }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="store" size={20} fill className="text-primary" />
                <div className="flex min-w-0 flex-col">
                  <p className="text-on-surface truncate text-headline-sm leading-tight font-headline">
                    {meetup.venue}
                  </p>
                  <p className="text-on-surface-variant text-body-sm leading-none">
                    {meetup.whenLabel}
                  </p>
                </div>
              </div>
              <span className="bg-primary text-on-primary sticker-xs shrink-0 rounded-xl border-2 border-ink px-2.5 py-1 text-label-status font-headline uppercase">
                {startsIn === null
                  ? "Live"
                  : startsIn > 0
                    ? `Starts in ${startsIn} min`
                    : "Started"}
              </span>
            </div>
          </MapCanvas>

          {/* ── Everyone arrived → recap ─────────────────────── */}
          {everyoneHere && !soloRoom && (
            <Link href={`/m/${meetup.code}/recap`} className="block">
              <div
                className="bg-primary-container text-on-primary-container sticker press flex items-center justify-between gap-2 rounded-sticker border-2 border-ink p-space-md"
                style={{ transform: "rotate(-0.5deg)" }}
              >
                <div className="min-w-0">
                  <p className="text-label-status font-headline uppercase opacity-80">
                    Mission accomplished
                  </p>
                  <p className="text-headline-sm font-headline">Everyone made it! 🎉</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-label-md font-headline">
                  See recap
                  <Icon name="arrow_forward" size={18} />
                </span>
              </div>
            </Link>
          )}

          {/* ── Body: solo lobby or live tracker ─────────────── */}
          {soloRoom ? (
            <WaitingState me={me} inviteUrl={inviteUrl} onShare={share} />
          ) : (
            <LiveTracker
              participants={participants}
              venue={venuePoint}
              myId={me.id}
              now={now}
              nudgeCounts={nudgeCounts}
              onNudge={(p) => nudge(p)}
            />
          )}
        </div>
      </Shell>

      {/* ── Sticky status bar ──────────────────────────────── */}
      <div className="bg-surface/90 fixed right-0 bottom-0 left-0 z-40 mx-auto max-w-[540px] p-margin pb-safe backdrop-blur-md">
        <div className="flex flex-col gap-space-xs">
          {me.status !== "arrived" && (
            <SharingStrip
              location={location}
              distance={myDistance}
              canSwitchToGps={!location.sharing && me.status !== "idle" && gpsAvailable}
            />
          )}

          <PrimaryButton
            onClick={primaryAction}
            disabled={busy}
            className="h-14"
            style={{ backgroundColor: cta.color }}
          >
            <Icon name={busy ? "sync" : cta.icon} size={24} className={busy ? "animate-spin" : ""} />
            {cta.label}
          </PrimaryButton>

          <div className="grid grid-cols-2 gap-space-sm pt-1">
            {location.sharing ? (
              <GhostButton
                onClick={async () => {
                  await location.stop();
                  toast("Stopped sharing — your location was erased", "location_off");
                }}
              >
                <Icon name="location_off" size={18} />
                Stop sharing
              </GhostButton>
            ) : offerGps ? (
              <GhostButton onClick={() => setEtaOpen(true)}>
                <Icon name="schedule" size={18} />
                Use an ETA
              </GhostButton>
            ) : myStatus === "moving" || myStatus === "late" ? (
              <GhostButton
                disabled={busy}
                onClick={() =>
                  write(() => runLate(me), "Told everyone you're 10 min behind ⚠️", "running_with_errors")
                }
              >
                <Icon name="running_with_errors" size={18} className="text-error" />
                +10 min late
              </GhostButton>
            ) : (
              <GhostButton onClick={share}>
                <Icon name="content_copy" size={18} />
                Copy invite
              </GhostButton>
            )}

            <a
              href={directionsUrl(meetup)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-container-lowest text-on-surface sticker-sm press flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border-2 border-ink px-3 text-label-md font-headline"
            >
              <Icon name="near_me" size={18} className="text-primary" />
              Open maps
            </a>
          </div>
        </div>
      </div>

      {etaOpen && (
        <EtaSheet
          busy={busy}
          onClose={() => setEtaOpen(false)}
          onPick={async (mins) => {
            await write(() => leaveNow(me, mins), `On your way — ETA ${mins} min ⚡`, "navigation");
            setEtaOpen(false);
          }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirm
          venue={meetup.venue}
          people={participants.length}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await deleteMeetup(meetup.id);
              toast(`Deleted the meetup at ${meetup.venue}`, "delete");
              router.replace("/");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't delete the meetup", "error");
              setConfirmDelete(false);
            }
          }}
        />
      )}
    </>
  );
}

/** "Are you sure?" before a host deletes the room for everyone. */
function DeleteConfirm({
  venue,
  people,
  onCancel,
  onConfirm,
}: {
  venue: string;
  people: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const others = people - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        className="bg-surface-container-lowest sticker-lg flex w-full max-w-[340px] flex-col gap-4 rounded-[24px] border-2 border-ink p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-error-container sticker-sm mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink">
          <Icon name="delete" size={26} className="text-error" />
        </div>
        <div className="space-y-1">
          <h3 id="delete-title" className="text-on-surface text-headline-sm font-headline">
            Delete this meetup?
          </h3>
          <p className="text-on-surface-variant text-body-sm">
            The room at <span className="font-headline">{venue}</span> is removed for everyone
            {others > 0 ? ` — ${others} ${others === 1 ? "other person is" : "others are"} in it` : ""}.
            Their locations and nudges go too. This can&apos;t be undone.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <PrimaryButton
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            style={{ backgroundColor: "var(--color-error)" }}
          >
            <Icon name={deleting ? "sync" : "delete"} size={20} className={deleting ? "animate-spin" : ""} />
            {deleting ? "Deleting…" : "Delete meetup"}
          </PrimaryButton>
          <GhostButton onClick={onCancel} disabled={deleting} className="w-full">
            Keep it
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

/** What sharing is doing right now, above the main button. */
function SharingStrip({
  location,
  distance,
  canSwitchToGps,
}: {
  location: ReturnType<typeof useLocationSharing>;
  distance: number | null;
  canSwitchToGps: boolean;
}) {
  if (location.state === "denied") {
    return (
      <p className="bg-error-container text-on-error-container rounded-xl border-2 border-ink px-3 py-2 text-body-sm">
        Location is blocked for this site. Allow it in your browser&apos;s site settings, or use an
        ETA instead.
      </p>
    );
  }

  if (location.sharing) {
    const headline =
      location.state === "locating"
        ? "Finding you…"
        : location.state === "unavailable"
          ? "No GPS signal yet — try near a window"
          : distance !== null
            ? `Live · ${formatDistance(distance)} to go · ~${travelMinutes(distance, location.fix?.speed ?? null)} min`
            : "Sharing your live location";

    return (
      <div className="bg-surface-container-lowest sticker-xs flex items-center justify-between gap-2 rounded-xl border-2 border-ink px-3 py-2">
        <div className="min-w-0">
          <p className="text-on-surface flex items-center gap-1.5 text-label-md font-headline">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${location.state === "live" ? "animate-pulse" : ""}`}
              style={{ backgroundColor: "var(--color-status-arrived)" }}
            />
            <span className="truncate">{headline}</span>
          </p>
          <p className="text-on-surface-variant text-[11px] leading-tight">
            Keep this page open — phones pause location in the background.
          </p>
        </div>
        {location.wakeLockSupported && (
          <label className="text-on-surface-variant flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-headline">
            <input
              type="checkbox"
              checked={location.keepAwake}
              onChange={(e) => location.setKeepAwake(e.target.checked)}
              className="accent-[var(--color-primary-container)] h-4 w-4"
            />
            Screen on
          </label>
        )}
      </div>
    );
  }

  if (canSwitchToGps) {
    return (
      <button
        type="button"
        onClick={location.start}
        className="text-on-surface-variant flex items-center justify-center gap-1 py-1 text-label-md font-headline underline"
      >
        <Icon name="my_location" size={16} className="text-primary" />
        Share live location instead
      </button>
    );
  }

  return null;
}
