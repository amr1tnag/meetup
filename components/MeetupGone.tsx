import Link from "next/link";
import { AppHeader, Shell } from "./AppHeader";
import { PrimaryButton, StickerCard } from "./ui";

/** Shown when a room no longer exists — deleted, or never was. */
export function MeetupGone({ code, ended }: { code: string; ended: boolean }) {
  return (
    <>
      <AppHeader context={ended ? "Meetup ended" : "Not found"} />
      <Shell>
        <StickerCard className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
          <span className="text-headline-lg">{ended ? "👋" : "🫥"}</span>
          <h1 className="text-headline-md font-headline">
            {ended ? "The host ended this meetup" : "No such room"}
          </h1>
          <p className="text-on-surface-variant text-body-md">
            {ended ? (
              "The room and everyone's locations have been deleted."
            ) : (
              <>
                <span className="font-headline">{code}</span> doesn&apos;t exist. Double-check the
                link you were sent.
              </>
            )}
          </p>
          <Link href="/create" className="w-full">
            <PrimaryButton>Start a meetup</PrimaryButton>
          </Link>
        </StickerCard>
      </Shell>
    </>
  );
}
