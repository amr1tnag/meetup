"use client";

import { Icon } from "./Icon";
import { GhostButton } from "./ui";

const OPTIONS = [5, 10, 15, 20, 30, 45] as const;

/**
 * "How long will you be?" — the fallback for people who don't share live
 * location. This one number drives their countdown and orbit on the map.
 */
export function EtaSheet({
  onPick,
  onClose,
  busy,
}: {
  onPick: (minutes: number) => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="How long will you be?"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest sticker-lg mx-auto w-full max-w-[540px] rounded-t-[24px] border-2 border-b-0 border-ink p-margin pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-on-surface/20 mx-auto mb-4 h-1.5 w-12 rounded-full" />

        <div className="mb-4 flex items-center gap-2">
          <span className="bg-primary-container sticker-xs flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink">
            <Icon name="directions_run" size={20} className="text-on-primary" />
          </span>
          <div>
            <h2 className="text-headline-sm font-headline">How long will you be?</h2>
            <p className="text-on-surface-variant text-body-sm">
              Your friends see a countdown, not your location.
            </p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-label={`${m} minutes`}
              disabled={busy}
              onClick={() => onPick(m)}
              className="bg-tertiary-fixed text-on-tertiary-fixed sticker-sm press flex flex-col items-center rounded-xl border-2 border-ink py-3 font-headline disabled:opacity-60"
            >
              <span className="text-headline-md">{m}</span>
              <span className="text-label-status uppercase">min</span>
            </button>
          ))}
        </div>

        <GhostButton onClick={onClose} className="mb-2 w-full" disabled={busy}>
          Not yet
        </GhostButton>
      </div>
    </div>
  );
}
