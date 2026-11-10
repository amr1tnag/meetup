"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./Icon";

export function AppHeader({
  context,
  showBack = true,
}: {
  context?: string;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="bg-surface/85 fixed top-0 z-50 w-full pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[540px] items-center justify-between gap-space-sm px-margin">
        <div className="flex min-w-0 items-center gap-space-sm">
          {showBack && (
            <button
              aria-label="Go back"
              onClick={() => router.back()}
              className="text-on-surface hover:bg-surface-container -ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-transform active:scale-95"
            >
              <Icon name="arrow_back" size={22} />
            </button>
          )}

          <Link href="/" className="flex items-center gap-space-xs">
            <span className="bg-primary-container sticker-xs flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink">
              <Icon name="location_on" size={18} fill className="text-on-primary" />
            </span>
            <span className="text-on-surface text-headline-sm font-headline tracking-tight">
              Meet up
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-space-sm">
          {context && (
            <span className="text-on-surface-variant hidden max-w-[130px] truncate text-label-md font-headline xs:inline-block">
              {context}
            </span>
          )}
          <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink">
            <Icon name="person" size={18} className="text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Mobile-first shell: 540px column, header offset, safe-area padding. */
export function Shell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`bg-surface relative mx-auto flex w-full max-w-[540px] flex-1 flex-col px-margin pt-16 pb-safe ${className}`}
    >
      {children}
    </main>
  );
}
