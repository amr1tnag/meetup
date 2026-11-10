"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { GhostButton, PrimaryButton, StickerCard, StubDivider } from "./ui";
import { useToast } from "./Toast";
import type { Participant } from "@/lib/types";
import { initials } from "@/lib/types";

/** The "you're first here" state: everything points at sharing the link. */
export function WaitingState({
  me,
  inviteUrl,
  onShare,
}: {
  me: Participant;
  inviteUrl: string;
  onShare: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      /* clipboard blocked — the link is still selectable on screen */
    }
    setCopied(true);
    toast("Copied meetup link!", "link");
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <StickerCard className="sticker-md flex flex-col gap-5 p-space-lg">
        <div className="flex justify-center pt-2">
          <WaitingMascot />
        </div>

        <div className="space-y-1.5 px-1 text-center">
          <h2 className="text-on-surface text-headline-md font-headline tracking-tight">
            Waiting for the others to open the link
          </h2>
          <p className="text-on-surface-variant text-body-md">
            You&apos;re the first one here! Send the link to the group chat so
            people can drop their ETA.
          </p>
        </div>

        {/* Active participants strip */}
        <div className="bg-surface-container-low sticker-sm flex items-center justify-between gap-2 rounded-xl border-2 border-ink px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex -space-x-2">
              <span
                className="sticker-xs z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-headline-sm font-headline text-ink"
                style={{ backgroundColor: me.tint }}
              >
                {initials(me.name)}
              </span>
              <span className="bg-surface-container-high text-on-surface-variant sticker-xs flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-label-md font-headline opacity-70">
                ?
              </span>
              <span className="bg-surface-container-high text-on-surface-variant sticker-xs flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-label-md font-headline opacity-50">
                ?
              </span>
            </div>
            <span className="text-on-surface truncate text-label-md font-headline">
              Just you so far
            </span>
          </div>
          <span
            className="sticker-xs flex shrink-0 items-center gap-1 rounded-full border-2 border-ink px-2.5 py-1 text-label-status font-headline uppercase"
            style={{ backgroundColor: "var(--color-status-arrived)", color: "#fff" }}
          >
            <Icon name="check_circle" size={13} />
            Radar on
          </span>
        </div>

        <StubDivider />

        {/* Share link box */}
        <div className="bg-surface-container-low sticker-sm flex items-center gap-2 rounded-2xl border-2 border-ink p-1.5 pl-3">
          <Icon name="link" size={18} className="text-on-surface-variant" />
          <span className="text-on-surface flex-1 truncate text-label-md font-headline select-all">
            {inviteUrl.replace(/^https?:\/\//, "")}
          </span>
          <GhostButton onClick={copyLink} className="min-h-[36px] shrink-0 py-2">
            <Icon name={copied ? "done" : "content_copy"} size={16} />
            {copied ? "Copied!" : "Copy"}
          </GhostButton>
        </div>

        <PrimaryButton onClick={onShare}>
          Share link to group chat
          <span className="text-[18px]">💬</span>
        </PrimaryButton>

        <div className="grid grid-cols-2 gap-2">
          {/* Nobody's joined yet, so there's no one to nudge in-app —
              the only way to reach them is the group chat. */}
          <GhostButton onClick={onShare} className="bg-surface-container!">
            <Icon name="campaign" size={16} className="text-primary" />
            Ping the chat
          </GhostButton>
          <GhostButton
            onClick={() => setQrOpen(true)}
            className="bg-surface-container!"
          >
            <Icon name="qr_code_2" size={16} />
            Show QR
          </GhostButton>
        </div>
      </StickerCard>

      {/* Pro tip sticker */}
      <div
        className="bg-tertiary-fixed sticker flex items-start gap-space-sm rounded-2xl border-2 border-ink p-space-md"
        style={{ transform: "rotate(-0.75deg)" }}
      >
        <span className="bg-surface-container-lowest sticker-xs flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink text-[16px]">
          💡
        </span>
        <div className="space-y-0.5">
          <span className="text-on-tertiary-fixed block text-label-md font-headline uppercase">
            Pro tip
          </span>
          <p className="text-on-tertiary-fixed text-body-sm leading-snug">
            People start moving 15 minutes faster once they see someone is
            already there. Slap that link into the chat.
          </p>
        </div>
      </div>

      {qrOpen && <QrModal url={inviteUrl} onClose={() => setQrOpen(false)} />}
    </>
  );
}

/** Cartoon pin with eyes that shift every couple of seconds. */
function WaitingMascot() {
  const positions = [
    { top: 2, left: 2 },
    { top: 2, left: 6 },
    { top: 6, left: 4 },
    { top: 3, left: 4 },
  ];
  const [eye, setEye] = useState(positions[3]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setEye(positions[Math.floor(Math.random() * positions.length)]!);
    }, 2200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg
        aria-hidden
        className="text-primary-fixed absolute inset-0 h-full w-full animate-spin"
        style={{ animationDuration: "24s" }}
        fill="currentColor"
        viewBox="0 0 100 100"
      >
        <path
          d="M50 0 L55 35 L90 20 L65 45 L100 50 L65 55 L90 80 L55 65 L50 100 L45 65 L10 80 L35 55 L0 50 L35 45 L10 20 L45 35 Z"
          opacity="0.45"
        />
      </svg>

      <div className="bg-primary-container sticker relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-ink p-2">
        <div className="mb-1 flex items-center gap-1.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-surface-container-lowest sticker-xs relative h-4 w-4 overflow-hidden rounded-full border border-ink"
            >
              <div
                className="bg-on-surface absolute h-2 w-2 rounded-full transition-all duration-300"
                style={{ top: eye!.top, left: eye!.left }}
              />
            </div>
          ))}
        </div>
        <div className="bg-on-primary-container h-2.5 w-5 rounded-b-full" />

        <div
          className="bg-tertiary-fixed sticker-sm absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink"
          style={{ transform: "rotate(12deg)" }}
        >
          <Icon name="schedule" size={16} className="text-on-tertiary-fixed" />
        </div>
      </div>

      <span
        className="bg-tertiary-fixed text-on-tertiary-fixed sticker-sm absolute -top-1 -right-2 rounded-full border-2 border-ink px-2 py-0.5 text-label-status font-headline uppercase"
        style={{ transform: "rotate(6deg)" }}
      >
        solo spot
      </span>
    </div>
  );
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Scan to join"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest sticker-lg flex w-full max-w-[320px] flex-col items-center gap-4 rounded-[24px] border-2 border-ink p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary-container sticker-sm flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink">
          <Icon name="qr_code_scanner" size={28} className="text-on-primary" />
        </div>
        <div>
          <h3 className="text-on-surface text-headline-sm font-headline">
            Scan to join
          </h3>
          <p className="text-on-surface-variant text-body-sm">
            Friends point their camera to open the live lobby
          </p>
        </div>
        <div className="bg-surface-container sticker-sm rounded-2xl border-2 border-ink p-3">
          {/* Decorative stand-in: wire to a real QR encoder for scannable codes. */}
          <svg
            aria-hidden
            className="text-on-surface h-40 w-40"
            fill="currentColor"
            viewBox="0 0 100 100"
          >
            <path d="M10 10 H40 V40 H10 Z M15 15 V35 H35 V15 Z M20 20 H30 V30 H20 Z" />
            <path d="M60 10 H90 V40 H60 Z M65 15 V35 H85 V15 Z M70 20 H80 V30 H70 Z" />
            <path d="M10 60 H40 V90 H10 Z M15 65 V85 H35 V65 Z M20 70 H30 V80 H20 Z" />
            <path d="M60 60 H70 V70 H60 Z M80 60 H90 V70 H80 Z M70 70 H80 V80 H70 Z M60 80 H70 V90 H60 Z M80 80 H90 V90 H80 Z" />
            <path d="M45 10 H55 V25 H45 Z M45 35 H55 V50 H45 Z M10 45 H25 V55 H10 Z M35 45 H50 V55 H35 Z" />
          </svg>
        </div>
        <p className="text-on-surface-variant text-label-status font-headline break-all">
          {url.replace(/^https?:\/\//, "")}
        </p>
        <GhostButton onClick={onClose} className="bg-surface-container! w-full">
          Close
        </GhostButton>
      </div>
    </div>
  );
}
