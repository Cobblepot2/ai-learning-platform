"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", path: "", exact: true },
  { label: "Curriculum", path: "/curriculum" },
  { label: "Students", path: "/students" },
  { label: "Preview", path: "/preview" },
  { label: "Settings", path: "/settings" },
];

export function CourseWorkspaceNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/teach/courses/${courseId}`;

  return (
    <nav
      aria-label="Course workspace"
      className="-mb-px mt-6 flex gap-1 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.path}`;
        const active = tab.exact
          ? pathname === base
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
              active
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
