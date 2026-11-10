"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, Shell } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { PrimaryButton, StickerCard } from "@/components/ui";
import { VenuePicker, type Spot } from "@/components/VenuePicker";
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

  const [spot, setSpot] = useState<Spot | null>(null);
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
    if (!spot) {
      toast("Search for the spot and pick it first 📍", "place");
      return;
    }
    setSubmitting(true);
    const when = resolveWhen(choice, customTime, Date.now());
    try {
      const code = await createMeetup({
        venue: spot.venue,
        area: spot.area,
        whenLabel: when.whenLabel,
        minutesFromNow: when.minutesFromNow,
        hostName: nickname,
        lat: spot.lat,
        lng: spot.lng,
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
            <VenuePicker value={spot} onChange={setSpot} />

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
