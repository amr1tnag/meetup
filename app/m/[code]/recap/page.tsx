"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { GhostButton, PrimaryButton, StickerCard } from "@/components/ui";
import { useRoom } from "@/lib/room";
import { type Participant, clockTime, initials } from "@/lib/types";

/** Playful rank titles, in arrival order. */
const RANKS = [
  { badge: "👑", medal: "🥇", title: "The pacesetter", tone: "bg-tertiary-fixed" },
  { badge: "🥈", medal: "⚡", title: "Solid effort", tone: "bg-surface-container-low" },
  { badge: "🥉", medal: "🏃", title: "Just in time", tone: "bg-surface-container-low" },
  { badge: "🐢", medal: "🧋", title: "Chief anchor", tone: "bg-surface-container-high" },
] as const;

export default function RecapPage() {
  // useParams is runtime-only, so it needs a boundary to stream into.
  return (
    <Suspense fallback={<RecapLoading />}>
      <RecapScreen />
    </Suspense>
  );
}

function RecapLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[540px] flex-1 items-center justify-center px-margin">
      <Icon name="sync" size={28} className="text-primary animate-spin" />
    </main>
  );
}

function RecapScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();
  const { room, reload } = useRoom(code);

  // Only members see the recap; anyone else goes to the invite.
  useEffect(() => {
    if (room.kind === "preview") router.replace(`/j/${code}`);
  }, [room.kind, code, router]);

  if (room.kind === "loading" || room.kind === "preview") return <RecapLoading />;

  if (room.kind !== "member") {
    return (
      <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col justify-center px-margin pt-safe">
        <StickerCard className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="text-headline-lg">📭</span>
          <h1 className="text-headline-md font-headline">No recap here</h1>
          <p className="text-on-surface-variant text-body-md">
            {room.kind === "error"
              ? room.message
              : `There's no meetup at ${code}.`}
          </p>
          {room.kind === "error" ? (
            <PrimaryButton onClick={reload}>Try again</PrimaryButton>
          ) : (
            <Link href="/create" className="w-full">
              <PrimaryButton>Plan a meetup</PrimaryButton>
            </Link>
          )}
        </StickerCard>
      </main>
    );
  }

  const { meetup, participants, nudges } = room;

  /* ── Derive the whole poster from real arrival data ──────────── */

  const arrived = participants
    .filter((p): p is Participant & { arrivedAt: string } => p.arrivedAt !== null && p.status === "arrived")
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  const missing = participants.filter((p) => p.status !== "arrived");

  const first = arrived[0];
  const last = arrived[arrived.length - 1];
  const startMs = new Date(meetup.startsAt).getTime();
  const at = (iso: string) => new Date(iso).getTime();

  // Total time the early birds spent waiting on everyone else.
  const waitMinutes = last
    ? arrived.reduce(
        (sum, p) => sum + Math.max(0, Math.round((at(last.arrivedAt) - at(p.arrivedAt)) / 60_000)),
        0,
      )
    : 0;

  const firstDelta = first ? Math.round((startMs - at(first.arrivedAt)) / 60_000) : 0;
  const lastDelta = last ? Math.round((at(last.arrivedAt) - startMs) / 60_000) : 0;

  const nudgeCounts: Record<string, number> = {};
  for (const n of nudges) nudgeCounts[n.toParticipant] = (nudgeCounts[n.toParticipant] ?? 0) + 1;
  const mostNudged = [...participants].sort(
    (a, b) => (nudgeCounts[b.id] ?? 0) - (nudgeCounts[a.id] ?? 0),
  )[0];

  const allIn = missing.length === 0;

  async function share() {
    const text = allIn
      ? `Everyone made it to ${meetup.venue}!${last && lastDelta > 0 ? ` ${last.name} was ${lastDelta} min late 🚨` : ""}`
      : `${arrived.length} of ${participants.length} made it to ${meetup.venue}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Meet up recap — ${meetup.venue}`, text });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Recap copied to clipboard! 📋", "content_copy");
    } catch {
      toast("Screenshot this card to share 📸", "photo_camera");
    }
  }

  return (
    <main className="bg-surface mx-auto flex w-full max-w-[540px] flex-1 flex-col px-margin pt-safe pb-safe">
      <div className="flex w-full flex-col gap-4 py-4">
        {/* ── The poster ───────────────────────────────────────── */}
        <div className="bg-surface-container-lowest sticker-md relative flex flex-col gap-4 overflow-hidden rounded-sticker border-2 border-ink p-4 select-none">
          {/* Decorative sticker, parked on the hero's empty top-right corner
              so it never lands on the badge row's timestamp. */}
          <span
            className="bg-tertiary-fixed sticker-sm pointer-events-none absolute top-14 -right-3 z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink text-headline-sm"
            style={{ transform: "rotate(12deg)" }}
          >
            🎉
          </span>

          {/* Badge row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="bg-secondary-container text-on-secondary-container inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1">
              <Icon name="local_bar" size={14} fill />
              <span className="truncate text-label-status font-headline uppercase">
                Recap • {meetup.venue}
              </span>
            </span>
            <span className="bg-surface-container-high text-on-surface shrink-0 rounded-full px-2.5 py-1 text-label-status font-headline uppercase">
              {last ? clockTime(last.arrivedAt) : meetup.whenLabel}
            </span>
          </div>

          {/* Hero */}
          <div
            className="bg-primary-container text-on-primary-container sticker relative overflow-hidden rounded-xl border-2 border-ink p-4"
            style={{ transform: "rotate(-0.5deg)" }}
          >
            <div className="relative z-10 flex flex-col">
              <span className="mb-1 text-label-status font-headline uppercase opacity-80">
                {allIn ? "Mission accomplished" : "Still trickling in"}
              </span>
              <h1 className="text-display-hero-mobile font-headline tracking-tight">
                {allIn ? "Everyone made it! 🎉" : `${arrived.length} in, ${missing.length} out`}
              </h1>
              <p className="mt-1 text-body-md font-medium">
                {arrived.length} of {participants.length} accounted for at {meetup.venue}
                {last && `, ${clockTime(last.arrivedAt)}`}
              </p>
            </div>
            <span className="pointer-events-none absolute -right-4 -bottom-6 text-8xl opacity-10 select-none">
              🍻
            </span>
          </div>

          {/* Slapped-on sticker; inline so it can't cover the hero copy. */}
          <span
            className="bg-secondary-fixed text-on-secondary-fixed sticker-xs -mt-1 -ml-1 self-start rounded-full border-2 border-ink px-2 py-0.5 text-label-status font-headline"
            style={{ transform: "rotate(-6deg)" }}
          >
            VERIFIED ✨
          </span>

          {/* Leaderboard */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-on-surface text-label-md font-headline uppercase">
                Arrival order
              </span>
              <span className="text-outline text-label-status font-headline">TAP TO CHEER 👏</span>
            </div>

            {arrived.map((p, i) => {
              const rank = RANKS[Math.min(i, RANKS.length - 1)]!;
              const delta = Math.round((at(p.arrivedAt) - startMs) / 60_000);
              return (
                <button
                  key={p.id}
                  onClick={() => toast(`👏 Cheered ${p.name}!`, "celebration")}
                  className={`${rank.tone} sticker-xs flex items-center justify-between gap-2 rounded-xl border-2 border-ink p-3 text-left transition-transform active:scale-[0.98]`}
                  style={{ transform: `rotate(${i % 2 === 0 ? 0.5 : -0.5}deg)` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="sticker-xs relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-headline-sm"
                      style={{ backgroundColor: p.tint }}
                    >
                      {rank.badge}
                      <span className="bg-surface-container-lowest text-on-surface absolute -right-1 -bottom-1 rounded-full border border-ink px-1 text-label-status font-headline">
                        {i + 1}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="text-on-surface truncate text-headline-sm font-headline">
                          {p.name}
                        </span>
                        <span className="bg-surface-container-lowest text-on-surface shrink-0 rounded-full px-1.5 py-0.5 text-label-status font-headline uppercase">
                          {rank.title}
                        </span>
                      </span>
                      <span className="text-on-surface-variant text-body-sm">
                        Arrived {clockTime(p.arrivedAt)} •{" "}
                        {delta <= 0 ? `${Math.abs(delta)}m before time` : `${delta}m after start`}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 text-headline-sm">{rank.medal}</span>
                </button>
              );
            })}

            {missing.map((p) => (
              <div
                key={p.id}
                className="bg-surface-container flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-ink p-3 opacity-75"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink text-headline-sm"
                    style={{ backgroundColor: p.tint }}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-on-surface truncate text-headline-sm font-headline">
                      {p.name}
                    </span>
                    <span className="text-on-surface-variant text-body-sm">
                      {p.status === "idle" ? "Never left the house" : "Still not here"}
                    </span>
                  </span>
                </div>
                <span className="shrink-0 text-headline-sm">👻</span>
              </div>
            ))}
          </div>

          {/* Roast sticker for the last arrival */}
          {last && arrived.length > 1 && lastDelta > 0 && (
            <div
              className="bg-error-container text-on-error-container sticker relative overflow-hidden rounded-xl border-2 border-ink p-4"
              style={{ transform: "rotate(1deg)" }}
            >
              <div className="bg-error text-on-error mb-2 flex w-full items-center justify-between gap-2 rounded px-3 py-0.5 text-label-status font-headline uppercase">
                <span>⚠️ Caution: excuse alert</span>
                <span>Delay: +{lastDelta} min</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-headline-lg">🚨</span>
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-headline-sm font-headline">Latest arrival: {last.name}</h2>
                  <p className="mt-1 text-body-sm leading-snug opacity-90">
                    {lastDelta} min after the start time.
                    {(nudgeCounts[last.id] ?? 0) > 0 &&
                      ` Took ${nudgeCounts[last.id]} nudge${nudgeCounts[last.id] === 1 ? "" : "s"} to get there.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <StatTile
              label="Wait time"
              emoji="⏳"
              value={`${waitMinutes} mins`}
              sub="Total table waiting"
              tone="bg-surface-container"
              tilt={-1}
            />
            <StatTile
              label="Punctuality MVP"
              emoji="⏱️"
              value={first?.name ?? "—"}
              sub={
                first
                  ? firstDelta >= 0
                    ? `${firstDelta} min early to venue`
                    : `${Math.abs(firstDelta)} min after start`
                  : "Nobody yet"
              }
              tone="bg-tertiary-fixed"
              tilt={1}
            />
            <StatTile
              label="Last in"
              emoji="🚪"
              value={last?.name ?? "—"}
              sub={last ? `Rolled in at ${clockTime(last.arrivedAt)}` : "Still waiting"}
              tone="bg-secondary-fixed"
              tilt={1}
            />
            <StatTile
              label="Nudges sent"
              emoji="🔔"
              value={`${nudges.length} nudge${nudges.length === 1 ? "" : "s"}`}
              sub={
                mostNudged && (nudgeCounts[mostNudged.id] ?? 0) > 0
                  ? `Mostly at ${mostNudged.name}`
                  : "A peaceful group"
              }
              tone="bg-primary-fixed"
              tilt={-1}
            />
          </div>

          {/* Stamp footer */}
          <div className="text-on-surface-variant flex items-center justify-between gap-2 pt-2 opacity-75">
            <span className="truncate text-label-status font-headline">meetup • #{meetup.code}</span>
            <span className="shrink-0 text-label-status font-headline">No GPS used 🛡️</span>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={share}>
            <Icon name="send_to_mobile" size={20} fill />
            Share to group 📲
          </PrimaryButton>

          <GhostButton onClick={() => router.push("/create")} className="min-h-[52px] w-full">
            <Icon name="event_repeat" size={20} />
            Plan another meetup 🗓️
          </GhostButton>

          <Link
            href={`/m/${meetup.code}`}
            className="text-on-surface-variant mt-1 text-center text-label-md font-headline underline"
          >
            Back to the live room
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatTile({
  label,
  emoji,
  value,
  sub,
  tone,
  tilt,
}: {
  label: string;
  emoji: string;
  value: string;
  sub: string;
  tone: string;
  tilt: number;
}) {
  return (
    <div
      className={`${tone} sticker-xs flex flex-col justify-between rounded-xl border-2 border-ink p-3`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-on-surface-variant text-label-status font-headline uppercase">
          {label}
        </span>
        <span className="text-label-md">{emoji}</span>
      </div>
      <div className="mt-2">
        <span className="text-on-surface block truncate text-headline-md font-headline">{value}</span>
        <p className="text-on-surface-variant text-body-sm">{sub}</p>
      </div>
    </div>
  );
}
