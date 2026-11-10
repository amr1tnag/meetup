"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ───────────────────────────────────────────────────────────────
   Browser Supabase client.

   Created lazily on first use, never at module load: Next evaluates
   modules during `next build`, and the env vars may not exist there.
   The NEXT_PUBLIC_ values must be read with literal property access
   so Next can inline them into the client bundle.
   ─────────────────────────────────────────────────────────────── */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see README).",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

let sessionPromise: Promise<string> | null = null;

/**
 * Make sure this browser has an identity, signing in anonymously the
 * first time. Resolves to the user id. No email, no password: the
 * session lives in this browser, which is the whole "no accounts" pitch.
 */
export function ensureSession(): Promise<string> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session.user.id;

    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error || !anon.user) {
      throw new Error(error?.message ?? "Anonymous sign-in failed");
    }
    return anon.user.id;
  })();

  // Let a failed attempt be retried on the next call.
  sessionPromise.catch(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

/** Turn a Supabase/PostgREST error into a sentence for a toast. */
export function friendlyError(err: unknown): string {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  if (/fetch|network/i.test(msg)) return "Can't reach the server — check your connection";
  if (/anonymous sign-ins are disabled/i.test(msg))
    return "Anonymous sign-ins are off in Supabase (see README)";
  return msg;
}
