"use client";

import { Icon } from "./Icon";
import { Avatar, StatusChip, StickerCard } from "./ui";
import {
  type Participant,
  clockTime,
  etaMinutes,
  liveStatus,
} from "@/lib/types";
import {
  type LatLng,
  ago,
  distanceM,
  formatDistance,
  isStale,
  travelMinutes,
} from "@/lib/geo";

export function LiveTracker({
  participants,
  venue,
  myId,
  now,
  nudgeCounts,
  onNudge,
}: {
  participants: Participant[];
  venue: LatLng | null;
  myId: string;
  now: number | null;
  nudgeCounts: Record<string, number>;
  onNudge: (p: Participant) => void;
}) {
  return (
    <StickerCard className="flex flex-col gap-space-md p-space-md">
      <div className="bg-on-surface/20 mx-auto -mt-1 mb-1 h-1.5 w-12 rounded-full" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-space-sm">
          <h2 className="text-on-surface text-headline-md font-headline tracking-tight">
            Friend tracker
          </h2>
          <span className="text-primary bg-primary-fixed sticker-xs rounded-full border-2 border-ink px-2 py-0.5 text-headline-sm font-headline">
            {participants.length}
          </span>
        </div>
        <span className="bg-surface-container-low flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1">
          <span
            className="h-2 w-2 animate-pulse rounded-full"
            style={{ backgroundColor: "var(--color-status-arrived)" }}
          />
          <span className="text-on-surface-variant text-label-status font-headline uppercase">
            Live
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-space-sm">
        {participants.map((p) => (
          <FriendRow
            key={p.id}
            participant={p}
            venue={venue}
            isMe={p.id === myId}
            now={now}
            nudges={nudgeCounts[p.id] ?? 0}
            onNudge={() => onNudge(p)}
          />
        ))}
      </div>
    </StickerCard>
  );
}

function FriendRow({
  participant: p,
  venue,
  isMe,
  now,
  nudges,
  onNudge,
}: {
  participant: Participant;
  venue: LatLng | null;
  isMe: boolean;
  now: number | null;
  nudges: number;
  onNudge: () => void;
}) {
  const status = liveStatus(p, now);
  const eta = etaMinutes(p, now);

  const rowTone =
    status === "late"
      ? "bg-error-container/40 hover:bg-error-container/60"
      : "bg-surface-container-low hover:bg-surface-container";

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-ink p-3 transition-colors ${rowTone}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={p.name} tint={p.tint} status={status} size={44} />
        <div className="flex min-w-0 flex-col">
          <span className="text-on-surface truncate text-headline-sm font-headline">
            {p.name}
          </span>
          {/* Status and role badges share the second line so a long name
              never gets squeezed down to an initial. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <StatusChip status={status} />
            {p.isHost && (
              <span className="bg-secondary-fixed text-on-secondary-fixed sticker-xs shrink-0 rounded border border-ink px-1.5 text-[10px] font-headline uppercase">
                Host
              </span>
            )}
            {isMe && (
              <span className="bg-primary-fixed text-on-primary-fixed sticker-xs shrink-0 rounded border border-ink px-1.5 text-[10px] font-headline uppercase">
                You
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {status !== "arrived" && p.lat !== null && p.lng !== null ? (
          <GpsReadout p={{ ...p, lat: p.lat, lng: p.lng }} venue={venue} now={now} />
        ) : status === "arrived" ? (
          <>
            <p className="text-on-surface text-body-sm font-semibold">
              here since {p.arrivedAt ? clockTime(p.arrivedAt) : "just now"}
            </p>
            <p className="text-on-surface-variant text-[11px] font-headline">{p.note}</p>
          </>
        ) : status === "late" ? (
          <>
            <p className="text-error text-headline-sm font-headline">
              {eta && eta > 0 ? `${eta} min away` : "overdue"}
            </p>
            {!isMe ? (
              <NudgeButton name={p.name} count={nudges} onClick={onNudge} />
            ) : (
              <p className="text-on-surface-variant text-[11px] font-headline">{p.note}</p>
            )}
          </>
        ) : status === "moving" ? (
          <>
            <p className="bg-tertiary-fixed sticker-xs rounded-lg border border-ink px-2 py-0.5 text-body-sm font-bold text-ink">
              {eta === null ? "on the way" : eta > 0 ? `${eta} min away` : "any minute"}
            </p>
            <p className="text-on-surface-variant text-[11px] font-headline">
              left {p.leftAt ? clockTime(p.leftAt) : "just now"}
            </p>
          </>
        ) : (
          <>
            <p className="text-on-surface-variant text-[12px]">
              joined {clockTime(p.joinedAt)}
            </p>
            {!isMe && <NudgeButton name={p.name} count={nudges} onClick={onNudge} />}
          </>
        )}
      </div>
    </div>
  );
}

function NudgeButton({
  name,
  count,
  onClick,
}: {
  name: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-surface-container-highest text-on-surface sticker-sm press flex items-center gap-1 rounded-xl border-2 border-ink px-2.5 py-1"
    >
      <span className="text-label-status font-headline">
        Nudge {name.split(" ")[0]}
        {count > 0 && ` ·${count}`}
      </span>
      <Icon name="notifications" size={14} fill className="text-primary" />
    </button>
  );
}

/** Right-hand side of a row for someone sharing live GPS. */
function GpsReadout({
  p,
  venue,
  now,
}: {
  p: Participant & { lat: number; lng: number };
  venue: LatLng | null;
  now: number | null;
}) {
  const stale = isStale(p.locatedAt, now);
  const d = venue ? distanceM(p, venue) : null;

  return (
    <>
      <p
        className={`sticker-xs rounded-lg border border-ink px-2 py-0.5 text-body-sm font-bold text-ink ${
          stale ? "bg-surface-container-high" : "bg-tertiary-fixed"
        }`}
      >
        {d !== null
          ? `${formatDistance(d)} · ~${travelMinutes(d, p.speedMps)} min`
          : "sharing location"}
      </p>
      <p className="text-on-surface-variant flex items-center gap-1 text-[11px] font-headline">
        <span
          className={`h-1.5 w-1.5 rounded-full ${stale ? "" : "animate-pulse"}`}
          style={{
            backgroundColor: stale ? "var(--color-status-idle)" : "var(--color-status-arrived)",
          }}
        />
        {stale || !p.locatedAt ? `last seen ${ago(p.locatedAt ?? "", now)}` : "live GPS"}
      </p>
    </>
  );
}
