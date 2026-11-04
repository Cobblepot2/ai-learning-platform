import type { AppId } from "./config";

/** Rounded-square app icons drawn in SVG, so nothing depends on brand artwork. */
const TILE: Record<AppId, string> = {
  mail: "from-sky-400 to-blue-600",
  call: "from-emerald-400 to-green-600",
  notes: "from-amber-200 to-yellow-400",
  cody: "from-violet-500 to-fuchsia-600",
  review: "from-slate-600 to-slate-900",
  launch: "from-orange-400 to-rose-500",
};

function Glyph({ app }: { app: AppId }) {
  const stroke = app === "notes" ? "#7a5b00" : "white";
  const common = { fill: "none", stroke, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (app) {
    case "mail":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" {...common} />
          <path d="M4 7l8 6 8-6" {...common} />
        </svg>
      );
    case "call":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <rect x="3" y="6.5" width="12" height="11" rx="2.5" {...common} />
          <path d="M15 10.5l5.5-3v9l-5.5-3" {...common} />
        </svg>
      );
    case "notes":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <path d="M6 7h12M6 11.5h12M6 16h8" {...common} />
        </svg>
      );
    case "cody":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" {...common} />
          <path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" {...common} strokeWidth={1.6} />
        </svg>
      );
    case "review":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <circle cx="7" cy="6" r="2.2" {...common} />
          <circle cx="7" cy="18" r="2.2" {...common} />
          <circle cx="17" cy="18" r="2.2" {...common} />
          <path d="M7 8.2v7.6M17 15.8V11a3 3 0 00-3-3h-3.5M12.5 5.5L10 8l2.5 2.5" {...common} />
        </svg>
      );
    case "launch":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <path d="M12 3c3.5 2 5 5.5 4.5 10l-2 2.5h-5l-2-2.5C7 8.5 8.5 5 12 3z" {...common} />
          <circle cx="12" cy="9.5" r="1.6" {...common} />
          <path d="M9.5 15.5L7 20M14.5 15.5L17 20M12 16v4" {...common} strokeWidth={1.8} />
        </svg>
      );
  }
}

export function AppIcon({ app, size = 48 }: { app: AppId; size?: number }) {
  return (
    <span
      className={`grid place-items-center rounded-[22%] bg-gradient-to-b shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.35)] ${TILE[app]}`}
      style={{ width: size, height: size }}
    >
      <Glyph app={app} />
    </span>
  );
}

export function Avatar({ initials, tone, size = 40 }: { initials: string; tone: string; size?: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
