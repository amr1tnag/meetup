import type { ReactNode } from "react";
import { STATUS_META, type Status, initials } from "@/lib/types";
import { Icon } from "./Icon";

/* ── Sticker card: 2px ink edge, 20px corners, hard offset shadow ── */

export function StickerCard({
  children,
  className = "",
  tilt = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`bg-surface-container-lowest sticker rounded-sticker border-2 border-ink ${className}`}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {children}
    </Tag>
  );
}

/* ── Pills & chips ───────────────────────────────────────────────── */

export function Pill({
  children,
  className = "",
  tilt = 0,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
}) {
  return (
    <span
      className={`sticker-sm inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-label-status font-headline uppercase ${className}`}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="sticker-xs inline-flex items-center rounded-md border-2 border-ink px-2 py-0.5 text-label-status font-headline uppercase whitespace-nowrap"
      style={{ backgroundColor: meta.color, color: meta.onColor }}
    >
      {meta.label}
    </span>
  );
}

/* ── Avatars ─────────────────────────────────────────────────────── */

export function Avatar({
  name,
  tint,
  status,
  size = 44,
  tilt = 0,
  showDot = true,
}: {
  name: string;
  tint: string;
  status?: Status;
  size?: number;
  tilt?: number;
  showDot?: boolean;
}) {
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      <div
        className="sticker-sm flex h-full w-full items-center justify-center rounded-full border-2 border-ink font-headline font-bold text-ink"
        style={{ backgroundColor: tint, fontSize: Math.round(size * 0.4) }}
      >
        {initials(name)}
      </div>
      {showDot && status && (
        <span
          className="sticker-xs absolute right-0 bottom-0 rounded-full border-2 border-ink"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: STATUS_META[status].dot,
          }}
        />
      )}
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────── */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
  style,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`bg-primary-container text-on-primary sticker press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sticker border-2 border-ink text-label-lg font-headline disabled:opacity-70 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bg-surface-container-lowest text-on-surface sticker-sm press flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border-2 border-ink px-3 text-label-md font-headline disabled:opacity-70 ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Tear-off ticket-stub divider ────────────────────────────────── */

export function StubDivider() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="stub-divider w-full" />
    </div>
  );
}

/* ── Privacy footnote, repeated across the flow ──────────────────── */

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-on-surface-variant flex items-center justify-center gap-1.5 px-2 text-body-sm">
      <Icon name="verified_user" size={16} className="text-tertiary" />
      <span className="leading-tight">{children}</span>
    </div>
  );
}
