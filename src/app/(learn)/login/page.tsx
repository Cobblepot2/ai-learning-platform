"use client";

import { useState } from "react";
import { glass } from "@/components/home/glass";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function signInWithGitHub() {
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already navigating to GitHub.
    if (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className={`${glass} p-7 shadow-2xl sm:p-8`}>
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-2 text-white/60">Your project runs are saved to your account.</p>
      {!isSupabaseConfigured ? (
        <p className="mt-4 text-white/70">
          Accounts aren&apos;t enabled on this deployment yet.
        </p>
      ) : status === "sent" ? (
        <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
          Check <strong>{email}</strong> for a sign-in link.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <button
            type="button"
            onClick={signInWithGitHub}
            disabled={status === "sending"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-black hover:bg-white/85 disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continue with GitHub
          </button>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/15" />
            or use email
            <span className="h-px flex-1 bg-white/15" />
          </div>
          <p className="text-white/60">We&apos;ll email you a magic link, so there&apos;s no password to remember.</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@connect.polyu.hk"
            className="w-full rounded-full border border-white/20 bg-black/30 px-5 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full border border-white/25 bg-white/[0.06] px-5 py-3 font-medium text-white hover:border-white/50 hover:bg-white/10 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {status === "error" && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      )}
      </div>
    </div>
  );
}
