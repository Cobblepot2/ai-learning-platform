"use client";

import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-store";

const glow = "transition duration-300 hover:[text-shadow:0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(255,255,255,0.5)]";
const navLink = `rounded-full px-3 py-1.5 font-medium text-white/75 hover:text-white ${glow}`;
const menuLink = "block rounded-lg px-3 py-2 text-white/80 hover:bg-white/10";

/**
 * A floating glass pill on wide screens and a full-width glass bar on smaller
 * ones. The bar is fixed, so the layout pads the page below it.
 */
export function NavBar() {
  const { user, signOut } = useAuth();
  const initial = (user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-50 lg:top-8 lg:px-4">
      <nav className="mx-auto flex items-center gap-4 border-b border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150 lg:max-w-4xl lg:rounded-full lg:border lg:px-8 lg:py-3.5 lg:shadow-[0_8px_32px_rgba(0,0,0,0.3)] lg:backdrop-saturate-200">
        <Link href="/" className={`flex items-center gap-2.5 text-lg font-semibold text-white ${glow}`}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 text-sm text-white shadow-[0_0_16px_rgba(99,102,241,0.6)]">DP</span>
          <span className="hidden sm:inline">DevPath</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm sm:gap-3 lg:text-[15px]">
          <Link href="/projects" className={navLink}>
            Projects
          </Link>
          {user ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full px-1 py-0.5 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm font-semibold text-white">
                  {initial}
                </span>
                <span aria-hidden className="text-xs text-white/50">
                  ▾
                </span>
              </summary>
              <div className="absolute right-0 z-30 mt-3 w-60 rounded-2xl border border-white/15 bg-zinc-900/90 p-2 shadow-2xl backdrop-blur-xl">
                <p className="truncate px-3 py-2 text-xs text-white/45">{user.email}</p>
                <button type="button" onClick={() => void signOut()} className={`${menuLink} w-full text-left`}>
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            isSupabaseConfigured && (
              <Link href="/login" className="rounded-full bg-white px-4 py-1.5 font-medium text-black hover:bg-white/85">
                Sign in
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
