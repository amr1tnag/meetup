"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, Shell } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { PrimaryButton, StickerCard } from "@/components/ui";
import { createMeetup } from "@/lib/room";
import { useNow } from "@/lib/useNow";
import { useToast } from "@/components/Toast";

type Choice = "now" | "tonight" | "custom";

/** Resolve a choice into a label and an offset, against a given clock. */
function resolveWhen(
  choice: Choice,
  customTime: string,
  nowMs: number,
): { whenLabel: string; minutesFromNow: number } {
  if (choice === "now") return { whenLabel: "Right now!", minutesFromNow: 0 };

  const target = new Date(nowMs);
  if (choice === "tonight") {
    target.setHours(19, 30, 0, 0);
  } else {
    const [h, m] = customTime.split(":").map(Number);
    target.setHours(h ?? 20, m ?? 30, 0, 0);
  }

  const rollsOver = target.getTime() <= nowMs;
  if (rollsOver) target.setDate(target.getDate() + 1);

  const clock = target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    whenLabel: `${rollsOver ? "Tomorrow" : "Today"}, ${clock}`,
    minutesFromNow: Math.max(1, Math.round((target.getTime() - nowMs) / 60_000)),
  };
}

export default function CreatePage() {
  const router = useRouter();
  const toast = useToast();

  const [venue, setVenue] = useState("Bandra Social, Mumbai");
  const [nickname, setNickname] = useState("Amrit");
  const [choice, setChoice] = useState<Choice>("tonight");
  const [customTime, setCustomTime] = useState("20:30");
  const [submitting, setSubmitting] = useState(false);

  const now = useNow();

  // Before mount there is no clock to read, so show the plain chip label.
  const whenLabel = useMemo(() => {
    if (choice === "now") return "Right now!";
    if (now === null) return choice === "tonight" ? "Tonight, 7:30 PM" : customTime;
    return resolveWhen(choice, customTime, now).whenLabel;
  }, [choice, customTime, now]);

  async function handleCreate() {
    if (!venue.trim()) {
      toast("Pick a spot first 📍", "place");
      return;
    }
    setSubmitting(true);
    const when = resolveWhen(choice, customTime, Date.now());
    try {
      const code = await createMeetup({
        venue,
        area: venue,
        whenLabel: when.whenLabel,
        minutesFromNow: when.minutesFromNow,
        hostName: nickname,
      });
      router.push(`/m/${code}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create the meetup", "error");
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader context="Create Meetup" />
      <Shell>
        <div className="flex w-full flex-col pb-10 select-none">
          {/* Decorative sticker row */}
          <div className="mt-2 mb-3 flex items-center justify-between gap-2">
            <span
              className="bg-tertiary-fixed text-on-tertiary-fixed sticker-sm inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-label-status font-headline uppercase"
              style={{ transform: "rotate(-1deg)" }}
            >
              <Icon name="auto_awesome" size={15} fill />
              Start a hangout
            </span>
            <span
              className="bg-surface-container text-on-surface-variant sticker-xs inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-label-md font-headline"
              style={{ transform: "rotate(2deg)" }}
            >
              <span className="bg-primary-container h-1.5 w-1.5 animate-pulse rounded-full" />
              No app install
            </span>
          </div>

          {/* Hero */}
          <div className="relative mb-5">
            <h1 className="text-on-surface text-display-hero-mobile font-headline tracking-tight">
              Where are we
              <br />
              <span
                className="bg-primary-fixed text-on-primary-fixed sticker-xs mt-1 inline-block rounded-lg border-2 border-ink px-2 py-0.5"
                style={{ transform: "rotate(-1deg)" }}
              >
                meeting?
              </span>
            </h1>
            <span className="absolute -right-1 bottom-0 rotate-12 text-headline-lg opacity-80">
              📍
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* ── The Spot ─────────────────────────────────────── */}
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
                  {venue.trim() ? "Selected" : "Required"}
                </span>
              </div>

              <div className="relative flex items-center">
                <Icon
                  name="search"
                  size={20}
                  className="text-on-surface-variant pointer-events-none absolute left-3.5"
                />
                <input
                  id="venue"
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Cafe, bar, someone's flat…"
                  className="bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:border-primary-container w-full rounded-lg border-2 border-ink py-3 pr-10 pl-10 text-body-lg transition-colors focus:outline-none"
                />
                {venue && (
                  <button
                    type="button"
                    aria-label="Clear location"
                    onClick={() => setVenue("")}
                    className="bg-secondary-container text-on-secondary-container absolute right-3 flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>

              <div className="bg-surface-container relative h-36 w-full overflow-hidden rounded-lg border-2 border-ink">
                <MiniMap />
                <div className="from-inverse-surface/60 absolute inset-0 flex items-end justify-between bg-gradient-to-t via-transparent to-transparent p-2.5">
                  <span className="bg-surface-container-lowest/95 text-on-surface sticker-xs flex items-center gap-1.5 rounded-full border border-ink px-2.5 py-1 text-label-status font-headline backdrop-blur-sm">
                    <span className="bg-primary-container h-2 w-2 animate-ping rounded-full" />
                    {venue.trim() || "No spot picked yet"}
                  </span>
                </div>
              </div>
            </StickerCard>

            {/* ── When ─────────────────────────────────────────── */}
            <StickerCard className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface flex items-center gap-1.5 text-label-lg font-headline">
                  <Icon name="schedule" size={18} className="text-tertiary" />
                  When to meet?
                </span>
                <span className="bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-2 py-0.5 text-label-status font-headline">
                  {whenLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <TimeChip
                  active={choice === "now"}
                  onClick={() => setChoice("now")}
                  label="⚡ Now"
                  sub="Immediate"
                />
                <TimeChip
                  active={choice === "tonight"}
                  onClick={() => setChoice("tonight")}
                  label="Tonight"
                  sub="7:30 PM"
                />
                <TimeChip
                  active={choice === "custom"}
                  onClick={() => setChoice("custom")}
                  label="Custom…"
                  sub="Pick time"
                />
              </div>

              {choice === "custom" && (
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label="Custom meetup time"
                  className="bg-surface-container-low text-on-surface w-full rounded-lg border-2 border-ink px-3.5 py-2.5 text-body-lg font-headline focus:outline-none"
                />
              )}
            </StickerCard>

            {/* ── Organizer ────────────────────────────────────── */}
            <StickerCard className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="nickname"
                  className="text-on-surface flex items-center gap-1.5 text-label-lg font-headline"
                >
                  <Icon name="badge" size={18} className="text-secondary" />
                  What should friends call you?
                </label>
                <span className="bg-surface-container text-on-surface-variant rounded-full px-2 py-0.5 text-label-status font-headline uppercase">
                  Organizer
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <div className="bg-primary-fixed text-on-primary-fixed sticker-xs flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-headline-sm font-headline">
                  {nickname.trim() ? nickname.trim()[0]!.toUpperCase() : "?"}
                </div>
                <input
                  id="nickname"
                  type="text"
                  maxLength={18}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your name or alias"
                  className="bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:border-primary-container w-full rounded-lg border-2 border-ink px-3.5 py-2.5 text-body-lg transition-colors focus:outline-none"
                />
              </div>
            </StickerCard>

            {/* ── Roster preview ───────────────────────────────── */}
            <div className="bg-surface-container-low sticker-sm flex items-center justify-between gap-2 rounded-xl border-2 border-ink p-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex -space-x-2">
                  <span className="bg-primary text-on-primary sticker-xs flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-[10px] font-headline">
                    {nickname.trim() ? nickname.trim()[0]!.toUpperCase() : "?"}
                  </span>
                  <span className="bg-tertiary-fixed text-on-tertiary-fixed sticker-xs flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-[10px] font-headline">
                    ?
                  </span>
                  <span className="bg-secondary-container text-on-secondary-container sticker-xs flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-[10px] font-headline">
                    +
                  </span>
                </div>
                <span className="text-on-surface-variant truncate text-body-sm">
                  Friends join instantly via link
                </span>
              </div>
              <span className="bg-tertiary-fixed-dim/50 text-on-tertiary-container shrink-0 rounded-full px-2 py-0.5 text-label-status font-headline uppercase">
                Auto-live
              </span>
            </div>

            {/* ── CTA ──────────────────────────────────────────── */}
            <div className="mt-2 flex flex-col gap-2">
              <PrimaryButton onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Icon name="sync" size={20} className="animate-spin" />
                    Setting the table…
                  </>
                ) : (
                  <>
                    Create meetup link
                    <Icon name="arrow_forward" size={20} />
                  </>
                )}
              </PrimaryButton>

              <div className="text-on-surface-variant flex items-start justify-center gap-1.5 px-4 py-1 text-center">
                <Icon name="lock" size={15} className="mt-0.5" />
                <p className="text-body-sm">
                  Link auto-expires when everyone arrives. Locations are erased
                  immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    </>
  );
}

function TimeChip({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press flex flex-col items-center gap-0.5 rounded-lg border-2 border-ink px-2 py-2.5 text-center text-label-md font-headline ${
        active
          ? "bg-primary text-on-primary sticker-sm"
          : "bg-surface-container-low text-on-surface-variant"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] ${active ? "opacity-85" : "opacity-70"}`}>
        {sub}
      </span>
    </button>
  );
}

/** Tiny decorative map for the venue preview. */
function MiniMap() {
  return (
    <svg aria-hidden className="h-full w-full" viewBox="0 0 320 150">
      <rect width="320" height="150" fill="#efe9e0" />
      <rect x="12" y="92" width="80" height="50" rx="8" fill="#dbe7d4" />
      <g fill="#e4dcd1">
        <rect x="112" y="14" width="96" height="54" rx="5" />
        <rect x="228" y="78" width="80" height="60" rx="5" />
      </g>
      <g stroke="#fbf8f3" strokeLinecap="square">
        <path d="M0 76 H320" strokeWidth="11" />
        <path d="M104 0 V150" strokeWidth="11" />
        <path d="M220 0 V150" strokeWidth="6" />
      </g>
      <path d="M0 76 H320" stroke="#e8c9a0" strokeWidth="1.2" strokeDasharray="8 7" />
      <circle cx="160" cy="70" r="7" fill="#ff5a1f" stroke="#141414" strokeWidth="2" />
    </svg>
  );
}
