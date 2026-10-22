"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLearner } from "@/lib/learner-store";

const links = [
  {
    href: "/teach",
    label: "Overview",
    exact: true,
    icon: (
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    ),
  },
  {
    href: "/teach/courses",
    label: "Courses",
    icon: (
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11" />
    ),
  },
  {
    href: "/teach/students",
    label: "Students",
    icon: (
      <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm7.5 0a2.5 2.5 0 1 1 0 5M21 19v-1a4 4 0 0 0-3-3.87" />
    ),
  },
  {
    href: "/teach/invitations",
    label: "Invitations",
    icon: (
      <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
    ),
  },
];

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function TeachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useLearner();
  const initial = (profile?.displayName || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-stone-50 lg:flex">
      <aside className="border-b border-stone-800 bg-stone-950 text-stone-300 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500 text-sm font-semibold text-white">
            DP
          </span>
          <span className="font-semibold text-white">DevPath</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
            Teaching
          </span>
        </div>

        <nav
          aria-label="Teaching workspace"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1 lg:px-3 lg:pb-0"
        >
          {links.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-stone-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <NavIcon>{link.icon}</NavIcon>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden px-5 py-6 lg:block">
          <p className="text-xs leading-5 text-stone-500">
            Design courses, publish reviewed content and follow student progress.          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <p className="hidden text-sm font-medium text-stone-500 sm:block">
            Teaching workspace
          </p>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:inline-flex"
            >
              View as learner
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {initial}
                </span>
                <span className="hidden max-w-32 truncate text-sm sm:inline">
                  {profile?.displayName || user?.email || "Account"}
                </span>
                <span aria-hidden className="text-xs text-stone-400">
                  ▾
                </span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-stone-500">
                  {user?.email}
                </p>
                <Link
                  href="/"
                  className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 sm:hidden"
                >
                  View as learner
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                >
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}
