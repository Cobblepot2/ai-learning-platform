"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useLearner } from "@/lib/learner-store";

const navLink =
  "rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100";
const menuLink = "block rounded-md px-3 py-2 text-stone-700 hover:bg-stone-100";

export function NavBar() {
  const { profile, user, signOut } = useLearner();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsTeacher(false);
      return;
    }
    let active = true;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((account) => {
        if (active) setIsTeacher(!!account?.isTeacher);
      })
      .catch(() => {
        if (active) setIsTeacher(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const initial = (profile?.displayName || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">DP</span>
          <span className="hidden sm:inline">DevPath</span>
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-1 text-sm sm:gap-2">
          <Link href="/#courses" className={navLink}>
            Courses
          </Link>
          {user ? (
            <>
              <Link href="/my-courses" className={navLink}>
                My courses
              </Link>
              <Link href="/dashboard" className={navLink}>
                My progress
              </Link>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {initial}
                  </span>
                  <span className="hidden max-w-32 truncate sm:inline">
                    {profile?.displayName || "Account"}
                  </span>
                  <span aria-hidden className="text-xs text-stone-500">
                    ▾
                  </span>
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                  <p className="truncate px-3 py-2 text-xs text-stone-500">
                    {user.email}
                  </p>
                  <Link href="/onboarding" className={menuLink}>
                    Profile
                  </Link>
                  {isTeacher && (
                    <Link href="/teach" className={menuLink}>
                      Teaching studio
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className={`${menuLink} w-full text-left`}
                  >
                    Sign out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/onboarding" className={navLink}>
                {profile ? "Profile" : "Set up profile"}
              </Link>
              {isSupabaseConfigured && (
                <Link
                  href="/login"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
