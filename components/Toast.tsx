"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; message: string; icon: string };

const ToastContext = createContext<((message: string, icon?: string) => void) | null>(
  null,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, icon = "notifications_active") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, icon }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-20 left-1/2 z-[60] flex w-full max-w-[420px] -translate-x-1/2 flex-col items-center gap-2 px-margin"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-surface-container-lowest text-on-surface sticker flex animate-[toast-in_200ms_ease-out] items-center gap-2 rounded-2xl px-4 py-2.5 text-label-md font-headline"
          >
            <Icon name={t.icon} size={20} fill className="text-primary" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
