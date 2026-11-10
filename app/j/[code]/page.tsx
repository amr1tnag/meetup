"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader, Shell } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { Avatar, PrimaryButton, Pill, PrivacyNote, StickerCard } from "@/components/ui";
import { VenueMap } from "@/components/VenueMap";
import { useToast } from "@/components/Toast";
import { joinMeetup, useRoom } from "@/lib/room";
import { useNow } from "@/lib/useNow";
import { type Meetup, type Status, TINTS, initials, minutesUntil } from "@/lib/types";

export default function JoinPage() {
  // useParams is runtime-only, so it needs a boundary to stream into.
  return (
    <Suspense fallback={<LoadingShell />}>
      <JoinScreen />
    </Suspense>
  );
}

function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const { room, reload } = useRoom(code);

  const [name, setName] = useState("");
  const [tint, setTint] = useState<string>(TINTS[0].value);
  const [joining, setJoining] = useState(false);

  if (room.kind === "loading") return <LoadingShell />;

  if (room.kind === "error") {
    return (
      <>
        <AppHeader context="Invite" />
        <Shell>
          <StickerCard className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
            <span className="text-headline-lg">📡</span>
            <h1 className="text-headline-md font-headline">Couldn&apos;t open the invite</h1>
            <p className="text-on-surface-variant text-body-md">{room.message}</p>
            <PrimaryButton onClick={reload}>Try again</PrimaryButton>
          </StickerCard>
        </Shell>
      </>
    );
  }

  if (room.kind === "missing") {
    return (
      <>
        <AppHeader context="Invite" />
        <Shell>
          <StickerCard className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
            <span className="text-headline-lg">🕵️</span>
            <h1 className="text-headline-md font-headline">This link doesn&apos;t lead anywhere</h1>
            <p className="text-on-surface-variant text-body-md">
              There&apos;s no meetup at <span className="font-headline">{code}</span>. Check the
              link you were sent.
            </p>
            <Link href="/create" className="w-full">
              <PrimaryButton>Start your own</PrimaryButton>
            </Link>
          </StickerCard>
        </Shell>
      </>
    );
  }

  // One shape for the cards below, whether we're a member or not.
  const meetup: Meetup = room.meetup;
  const roster: { name: string; tint: string; status: Status; isHost: boolean }[] =
    room.kind === "member" ? room.participants : room.roster;
  const me = room.kind === "member" ? room.me : null;

  const host = roster.find((p) => p.isHost);
  const enRoute = roster.filter((p) => p.status === "moving" || p.status === "late").length;
  const startsIn = now === null ? null : minutesUntil(meetup.startsAt, now);

  async function handleJoin() {
    setJoining(true);
    try {
      await joinMeetup(code, name, tint);
      router.push(`/m/${code}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't join", "error");
      setJoining(false);
    }
  }

  return (
    <>
      <AppHeader context="Meetup Detail" />
      <Shell>
        <div className="flex w-full flex-col gap-4 pb-10">
          {/* Invite tag row */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Pill className="bg-tertiary-container text-on-tertiary-container" tilt={-1.5}>
              <span>🎉</span> You&apos;re invited!
            </Pill>
            <span className="bg-surface-container-high text-on-surface-variant inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-md font-headline">
              <span className="bg-primary-container h-2 w-2 animate-pulse rounded-full" />
              Live lobby
            </span>
          </div>

          {/* ── Plan summary ─────────────────────────────────── */}
          <StickerCard className="p-space-md">
            <div className="mb-3 flex items-start justify-between gap-space-sm">
              <div className="min-w-0">
                <span className="bg-primary-fixed text-on-primary-fixed mb-1.5 inline-block rounded-md px-2 py-0.5 text-label-status font-headline uppercase">
                  {startsIn !== null && startsIn <= 0 ? "Happening now" : "The plan"}
                </span>
                <h1 className="text-on-surface text-headline-md leading-snug font-headline tracking-tight">
                  {meetup.title}
                </h1>
                <p className="text-on-surface-variant mt-0.5 text-body-md">
                  {meetup.whenLabel} • Created by{" "}
                  <span className="text-on-surface font-headline">{host?.name ?? "the host"}</span>
                </p>
              </div>
              <div
                className="bg-tertiary-fixed sticker-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink"
                style={{ transform: "rotate(2deg)" }}
              >
                <Icon name="restaurant" size={26} className="text-on-tertiary-fixed" />
              </div>
            </div>

            <div className="bg-surface-container relative isolate mb-3 h-36 w-full overflow-hidden rounded-xl border-2 border-ink">
              {meetup.venueLat !== null && meetup.venueLng !== null ? (
                <>
                  <VenueMap lat={meetup.venueLat} lng={meetup.venueLng} zoom={15} />
                  <div className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full">
                    <div className="bg-primary-container sticker-sm flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink ring-4 ring-white/80">
                      <Icon name="location_on" size={16} fill className="text-on-primary" />
                    </div>
                  </div>
                </>
              ) : (
                <VenueStrip />
              )}
              {/* Tags sit at the top so OpenStreetMap's credit stays visible. */}
              <div className="pointer-events-none absolute top-2 right-2 left-2 z-[600] flex items-center justify-between gap-2">
                <span className="bg-surface-container-lowest/95 text-on-surface flex min-w-0 items-center gap-1 rounded-lg px-2.5 py-1 text-label-status font-headline backdrop-blur-md">
                  <Icon name="pin_drop" size={14} className="text-primary" />
                  <span className="truncate">{meetup.area}</span>
                </span>
                <span className="bg-inverse-surface text-inverse-on-surface shrink-0 rounded-lg px-2 py-1 text-label-status font-headline">
                  {roster.length} going
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <Icon name="schedule" size={16} className="text-primary-container" />
              <span className="text-on-surface-variant text-body-sm">
                {startsIn === null
                  ? "Starting soon"
                  : startsIn > 0
                    ? `Starts in ${startsIn} mins`
                    : "Started already"}
              </span>
            </div>
          </StickerCard>

          {/* ── Who's in ─────────────────────────────────────── */}
          <StickerCard className="bg-surface-container-low! p-space-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-on-surface text-headline-sm font-headline">Who&apos;s in?</span>
                <span className="bg-secondary-container text-on-secondary-container rounded-full px-2 py-0.5 text-label-status font-headline">
                  {roster.length} joined
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex items-center -space-x-3">
                {roster.slice(0, 5).map((p, i) => (
                  <Avatar key={i} name={p.name} tint={p.tint} status={p.status} size={44} />
                ))}
              </div>
              <div className="ml-4 min-w-0 flex-1">
                <p className="text-on-surface truncate text-body-sm">
                  {roster
                    .slice(0, 2)
                    .map((p) => p.name)
                    .join(", ")}
                  {roster.length > 2 &&
                    ` & ${roster.length - 2} ${roster.length === 3 ? "other" : "others"}`}
                </p>
                <p className="text-on-surface-variant flex items-center gap-1 text-label-status font-headline">
                  <Icon name="navigation" size={13} className="text-primary" />
                  {enRoute} currently en route
                </p>
              </div>
            </div>
          </StickerCard>

          {/* ── Join form, or a way back into the room ───────── */}
          {me ? (
            <StickerCard className="flex flex-col gap-3 p-space-md">
              <div className="flex items-center gap-3">
                <Avatar name={me.name} tint={me.tint} status={me.status} size={44} />
                <div className="min-w-0">
                  <p className="text-headline-sm font-headline">You&apos;re already in, {me.name}</p>
                  <p className="text-on-surface-variant text-body-sm">
                    Jump back into the live tracker.
                  </p>
                </div>
              </div>
              <PrimaryButton onClick={() => router.push(`/m/${code}`)}>
                <Icon name="near_me" size={20} />
                Open live meetup
              </PrimaryButton>
            </StickerCard>
          ) : (
            <StickerCard className="p-space-md">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="join-name" className="text-on-surface text-label-lg font-headline">
                  What do they call you?
                </label>
                <span className="text-primary text-label-status font-headline uppercase">
                  Required
                </span>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <div
                  className="sticker-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink text-headline-sm font-headline text-ink transition-colors"
                  style={{ backgroundColor: tint }}
                >
                  {name.trim() ? initials(name) : "?"}
                </div>
                <input
                  id="join-name"
                  type="text"
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim() && !joining) void handleJoin();
                  }}
                  placeholder="Enter your name or alias"
                  className="bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:border-primary-container w-full rounded-xl border-2 border-ink px-3.5 py-3 text-body-lg transition-all focus:outline-none"
                />
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant text-label-md font-headline">
                    Pick your sticker tint
                  </span>
                  <span className="text-on-surface-variant text-label-status font-headline uppercase">
                    Avatar color
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {TINTS.map((t) => {
                    const active = t.value === tint;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        aria-label={`${t.name} swatch`}
                        aria-pressed={active}
                        onClick={() => setTint(t.value)}
                        className={`flex h-9 items-center justify-center rounded-xl border-2 border-ink transition-transform active:scale-95 ${
                          active ? "sticker-sm" : "sticker-xs"
                        }`}
                        style={{ backgroundColor: t.value }}
                      >
                        {active && <Icon name="check" size={18} className="text-ink" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <PrimaryButton onClick={handleJoin} disabled={joining || !name.trim()}>
                {joining ? (
                  <>
                    <Icon name="sync" size={20} className="animate-spin" />
                    Connecting you…
                  </>
                ) : (
                  <>
                    <Icon name="near_me" size={20} />
                    Join the meetup
                  </>
                )}
              </PrimaryButton>

              <div className="mt-3">
                <PrivacyNote>
                  No GPS: friends only see the ETA you choose, and only inside this room.
                </PrivacyNote>
              </div>
            </StickerCard>
          )}

          <div className="bg-surface-container sticker-sm flex items-center justify-center gap-2 rounded-2xl border-2 border-ink p-3">
            <span className="text-base">⚡</span>
            <p className="text-on-surface text-center text-label-md font-headline">
              No app download. No accounts. Just show up.
            </p>
          </div>
        </div>
      </Shell>
    </>
  );
}

function LoadingShell() {
  return (
    <>
      <AppHeader />
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
          <Icon name="sync" size={28} className="text-primary animate-spin" />
          <p className="text-on-surface-variant text-label-md font-headline">Opening the lobby…</p>
        </div>
      </Shell>
    </>
  );
}

function VenueStrip() {
  return (
    <svg aria-hidden className="h-full w-full" viewBox="0 0 320 112">
      <rect width="320" height="112" fill="#efe9e0" />
      <rect x="16" y="68" width="76" height="44" rx="7" fill="#dbe7d4" />
      <g fill="#e4dcd1">
        <rect x="118" y="10" width="92" height="44" rx="5" />
        <rect x="236" y="60" width="72" height="48" rx="5" />
      </g>
      <g stroke="#fbf8f3" strokeLinecap="square">
        <path d="M0 58 H320" strokeWidth="10" />
        <path d="M110 0 V112" strokeWidth="10" />
      </g>
      <path d="M0 58 H320" stroke="#e8c9a0" strokeWidth="1.2" strokeDasharray="8 7" />
      <circle cx="170" cy="54" r="7" fill="#ff5a1f" stroke="#141414" strokeWidth="2" />
    </svg>
  );
}
