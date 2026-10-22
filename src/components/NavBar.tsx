"use client";

import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useLearner } from "@/lib/learner-store";

export function NavBar() {
  const { profile, user, signOut } = useLearner();
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">DP</span>
          <span className="hidden sm:inline">DevPath</span>
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-1 text-sm sm:gap-3">
          <Link href="/#courses" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            Courses
          </Link>
          <Link href="/my-courses" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">My courses</Link>
          <Link href="/studio" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">Teach</Link>
          <Link href="/dashboard" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            My progress
          </Link>
          <Link href="/onboarding" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            {profile ? "Profile" : "Set up profile"}
          </Link>
          {isSupabaseConfigured &&
            (user ? (
              <button type="button" onClick={signOut} className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
                Sign out
              </button>
            ) : (
              <Link href="/login" className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700">
                Sign in
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
