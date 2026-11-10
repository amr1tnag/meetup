"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader, Shell } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { GhostButton, Pill, PrimaryButton, PrivacyNote, StickerCard } from "@/components/ui";
import { useMyRooms } from "@/lib/room";

/** Pull a room code out of whatever was pasted: a full link or a bare code. */
function extractCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/(?:j|m)\/([a-z0-9-]+)/i);
  return (match?.[1] ?? trimmed).toLowerCase();
}

/**
 * Landing screen. The Stitch project has no home design, so this is built
 * from the same sticker system to tie the four designed screens together.
 */
export default function HomePage() {
  const router = useRouter();
  const rooms = useMyRooms();
  const [code, setCode] = useState("");

  const go = () => {
    const c = extractCode(code);
    if (c) router.push(`/j/${c}`);
  };

  return (
    <>
      <AppHeader showBack={false} context="Meet up" />
      <Shell>
        <div className="flex w-full flex-col gap-5 pb-12">
          <div className="flex items-center justify-between gap-2 pt-3">
            <Pill className="bg-tertiary-fixed text-on-tertiary-fixed" tilt={-1.5}>
              <Icon name="auto_awesome" size={15} fill />
              Group chat, but useful
            </Pill>
          </div>

          <div className="relative">
            <h1 className="text-on-surface text-display-hero-mobile font-headline tracking-tight">
              Stop asking
              <br />
              <span
                className="bg-primary-fixed text-on-primary-fixed sticker-xs mt-1 inline-block rounded-lg border-2 border-ink px-2 py-0.5"
                style={{ transform: "rotate(-1deg)" }}
              >
                “where are you?”
              </span>
            </h1>
            <p className="text-on-surface-variant mt-3 text-body-lg">
              Drop a pin, share one link, and watch the whole group close in on the spot.
              No installs, no accounts.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => router.push("/create")}>
              <Icon name="add_location_alt" size={22} />
              Start a meetup
            </PrimaryButton>
            <PrivacyNote>
              No GPS tracking. Friends see the ETA you pick, and only inside the room.
            </PrivacyNote>
          </div>

          {/* Join by code */}
          <StickerCard className="flex flex-col gap-3 p-4">
            <label
              htmlFor="code"
              className="text-on-surface flex items-center gap-1.5 text-label-lg font-headline"
            >
              <Icon name="link" size={18} className="text-primary" />
              Got a link or code?
            </label>
            <div className="flex items-center gap-2">
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") go();
                }}
                placeholder="Paste the invite link"
                className="bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:border-primary-container w-full rounded-lg border-2 border-ink px-3.5 py-2.5 text-body-lg transition-colors focus:outline-none"
              />
              <GhostButton onClick={go} disabled={!code.trim()} className="shrink-0">
                Join
              </GhostButton>
            </div>
          </StickerCard>

          {/* Your rooms */}
          {rooms && rooms.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant px-1 text-label-md font-headline uppercase">
                Your rooms
              </span>
              {rooms.map((m) => (
                <Link key={m.id} href={`/m/${m.code}`} className="block">
                  <div className="bg-surface-container-lowest sticker-sm press flex items-center justify-between gap-2 rounded-xl border-2 border-ink p-3">
                    <div className="min-w-0">
                      <p className="text-on-surface truncate text-headline-sm font-headline">
                        {m.venue}
                      </p>
                      <p className="text-on-surface-variant text-body-sm">{m.whenLabel}</p>
                    </div>
                    <Icon name="chevron_right" size={20} className="text-on-surface-variant" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Shell>
    </>
  );
}
