"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import type { ProjectView } from "@/lib/projects/runtime";
import { APPS, DOCK, STAGE_APP, type AppId, type Op } from "./config";
import { AppIcon } from "./icons";
import { mailbox } from "./mail";
import { Briefing, Notifications, ProjectWidget, Report, type Notice } from "./Overlays";
import { Window, type WindowFrame } from "./Window";
import { CallApp } from "./apps/CallApp";
import { CodyApp } from "./apps/CodyApp";
import { LaunchApp } from "./apps/LaunchApp";
import { MailApp } from "./apps/MailApp";
import { NotesApp } from "./apps/NotesApp";
import { ReviewApp } from "./apps/ReviewApp";

type WindowState = { open: boolean; minimised: boolean; zoomed: boolean; z: number; frame: WindowFrame };

const WALLPAPER = {
  background:
    "radial-gradient(120% 80% at 15% 110%, #f59e0b 0%, rgba(245,158,11,0) 45%), radial-gradient(90% 70% at 85% 105%, #db2777 0%, rgba(219,39,119,0) 50%), radial-gradient(120% 90% at 50% -10%, #1e3a8a 0%, rgba(30,58,138,0) 60%), linear-gradient(180deg, #312e81 0%, #7c3aed 45%, #f472b6 100%)",
};

/** What each stage announces when the learner reaches it. */
function noticeFor(view: ProjectView): Omit<Notice, "id"> | null {
  switch (view.stage.id) {
    case "inbox":
      return { app: "mail", title: "Mail", body: `${view.inbox.length} new messages, including one from ${view.scenario.client.name}.` };
    case "interview":
      return { app: "call", title: `${view.scenario.client.name} is calling`, body: "Open Meet to take the call." };
    case "requirements":
      return { app: "notes", title: "Call ended", body: "Write the requirements in Notes while it's fresh." };
    case "brief":
      return { app: "cody", title: "Requirements shared", body: "Cody is ready for its task." };
    case "review":
      return {
        app: "review",
        title: "Cody",
        body: view.track === "engineering" ? "Opened a pull request: review it before it reaches main." : "Recorded a walkthrough of the booking board. Review it.",
      };
    case "release":
      return { app: "launch", title: "Approved", body: "Plan how the clinic gets the booking board." };
    default:
      return null;
  }
}

function defaultFrame(index: number): WindowFrame {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const widget = vw >= 1280 ? 320 : 0;
  const w = Math.max(520, Math.min(900, vw - widget - 120));
  const h = Math.max(420, Math.min(620, vh - 170));
  return { x: 60 + index * 28, y: 48 + index * 22, w, h };
}

export function Desktop({
  scenarioId,
  title,
  summary,
}: {
  scenarioId: string;
  title: string;
  summary: string;
  client: { name: string; role: string; organisation: string };
}) {
  const { ready, user } = useAuth();
  const [view, setView] = useState<ProjectView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [windows, setWindows] = useState<Partial<Record<AppId, WindowState>>>({});
  const [focused, setFocused] = useState<AppId | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const zTop = useRef(10);
  const noticeId = useRef(0);
  const lastStage = useRef<string | null>(null);

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const notify = useCallback((notice: Omit<Notice, "id">) => {
    const id = ++noticeId.current;
    setNotices((list) => [...list.slice(-2), { ...notice, id }]);
    window.setTimeout(() => setNotices((list) => list.filter((item) => item.id !== id)), 7000);
  }, []);

  const openApp = useCallback((app: AppId) => {
    zTop.current += 1;
    const z = zTop.current;
    setWindows((all) => {
      const existing = all[app];
      const index = DOCK.indexOf(app);
      return {
        ...all,
        [app]: existing
          ? { ...existing, open: true, minimised: false, z }
          : { open: true, minimised: false, zoomed: false, z, frame: defaultFrame(index) },
      };
    });
    setFocused(app);
  }, []);

  const patchWindow = useCallback((app: AppId, patch: Partial<WindowState>) => {
    setWindows((all) => (all[app] ? { ...all, [app]: { ...all[app]!, ...patch } } : all));
  }, []);

  const send = useCallback(
    async (body: Op) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/projects/${scenarioId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please retry.");
        setView(data.view as ProjectView);
        return true;
      } catch (cause) {
        const message = (cause as Error).message;
        setError(message);
        notify({ app: null, title: "That didn't work", body: message });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [scenarioId, notify],
  );

  useEffect(() => {
    if (ready && user) void send({ op: "start" });
  }, [ready, user, send]);

  // A new stage brings its app forward and announces itself.
  useEffect(() => {
    if (!view) return;
    const stage = view.status === "completed" ? "completed" : view.stage.id;
    if (stage === lastStage.current) return;
    const first = lastStage.current === null;
    lastStage.current = stage;
    if (stage === "completed") {
      setReportOpen(true);
      return;
    }
    const app = STAGE_APP[view.stage.id];
    if (app) openApp(app);
    if (!first || stage === "inbox") {
      const notice = noticeFor(view);
      if (notice) notify(notice);
    }
  }, [view, openApp, notify]);

  const markRead = useCallback((id: string) => setRead((set) => new Set(set).add(id)), []);

  if (!ready || !user || !view) {
    return (
      <div className="grid h-full place-items-center p-4" style={WALLPAPER}>
        <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/85 p-6 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-xl font-bold text-stone-900">{title}</h1>
          {!ready ? (
            <p className="mt-3 text-[14px] text-stone-600">Starting up…</p>
          ) : !user ? (
            <>
              <p className="mt-3 text-[14px] text-stone-700">{summary}</p>
              <p className="mt-3 text-[14px] text-stone-600">Sign in to start. Your decisions are saved so you can come back.</p>
              <Link href="/login" className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 text-[14px] font-medium text-white">Sign in to start</Link>
            </>
          ) : error ? (
            <>
              <p className="mt-3 text-[14px] text-rose-700">{error}</p>
              <button type="button" onClick={() => void send({ op: "start" })} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-[14px] font-medium text-white">Retry</button>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-stone-600">Opening your desktop…</p>
          )}
          <Link href="/" className="mt-4 block text-[13px] text-stone-500 underline">Back to DevPath</Link>
        </div>
      </div>
    );
  }

  const unreadMail = mailbox(view).filter((mail) => !read.has(mail.id)).length;
  const stageApp = view.status === "active" ? STAGE_APP[view.stage.id] : null;
  const choosing = view.stage.id === "choose-track" && view.status === "active";
  const day = Math.min(view.meters.effortMax, view.meters.effort + 1);

  function renderApp(app: AppId) {
    if (!view) return null;
    switch (app) {
      case "mail":
        return <MailApp view={view} busy={busy} send={send} read={read} onRead={markRead} />;
      case "call":
        return <CallApp view={view} busy={busy} send={send} />;
      case "notes":
        return <NotesApp view={view} busy={busy} send={send} />;
      case "cody":
        return <CodyApp view={view} busy={busy} send={send} onOpenReview={() => openApp("review")} />;
      case "review":
        return <ReviewApp view={view} busy={busy} send={send} />;
      case "launch":
        return <LaunchApp view={view} busy={busy} send={send} onReport={() => setReportOpen(true)} />;
    }
  }

  return (
    <div className="relative h-full overflow-hidden font-sans" style={WALLPAPER}>
      {/* Menu bar */}
      <header className="absolute inset-x-0 top-0 z-[960] flex h-7 items-center gap-4 bg-white/40 px-3 text-[13px] text-stone-900 backdrop-blur-xl">
        <Link href="/" aria-label="Leave the desktop and return to DevPath" className="font-bold tracking-tight">◆</Link>
        <span className="font-semibold">{focused ? APPS[focused].name : "Finder"}</span>
        <span className="hidden text-stone-700 sm:inline">{view.scenario.title}</span>
        <span className="ml-auto tabular-nums text-stone-800">
          {view.status === "completed" ? "Job finished" : `Day ${day} of ${view.meters.effortMax}`}
        </span>
        <span className="hidden tabular-nums text-stone-800 sm:inline">Trust {view.meters.trust}/10</span>
      </header>

      <ProjectWidget view={view} onOpenApp={openApp} />

      {DOCK.map((app) => {
        const state = windows[app];
        if (!state?.open || state.minimised) return null;
        return (
          <Window
            key={app}
            title={APPS[app].title}
            frame={state.frame}
            z={state.z}
            focused={focused === app}
            zoomed={state.zoomed}
            compact={compact}
            onFocus={() => {
              if (focused !== app) openApp(app);
            }}
            onMove={(x, y) => patchWindow(app, { frame: { ...state.frame, x, y } })}
            onClose={() => {
              patchWindow(app, { open: false });
              if (focused === app) setFocused(null);
            }}
            onMinimise={() => {
              patchWindow(app, { minimised: true });
              if (focused === app) setFocused(null);
            }}
            onZoom={() => patchWindow(app, { zoomed: !state.zoomed })}
          >
            {renderApp(app)}
          </Window>
        );
      })}

      {/* Dock */}
      <nav aria-label="Dock" className="absolute bottom-2 left-1/2 z-[940] max-w-[calc(100%-1rem)] -translate-x-1/2">
        <ul className="flex items-end gap-2 overflow-x-auto rounded-[22px] border border-white/40 bg-white/30 px-2.5 pb-1.5 pt-2 shadow-2xl backdrop-blur-2xl">
          {DOCK.map((app) => {
            const running = windows[app]?.open;
            const badge = app === "mail" ? unreadMail : app === stageApp && !(running && focused === app) ? 1 : 0;
            return (
              <li key={app} className="relative">
                <button
                  type="button"
                  onClick={() => openApp(app)}
                  aria-label={`${APPS[app].name}${badge ? `, ${badge} new` : ""}`}
                  className="group flex flex-col items-center transition-transform duration-150 hover:-translate-y-2 motion-reduce:transition-none"
                >
                  <span className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded-md bg-stone-800/80 px-2 py-0.5 text-[12px] text-white group-hover:block">{APPS[app].name}</span>
                  <AppIcon app={app} size={compact ? 42 : 50} />
                  {badge > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white shadow">{badge}</span>
                  )}
                  <span className={`mt-1 h-1 w-1 rounded-full ${running ? "bg-stone-800" : "bg-transparent"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Notifications
        notices={notices}
        onOpen={(notice) => {
          if (notice.app) openApp(notice.app);
          setNotices((list) => list.filter((item) => item.id !== notice.id));
        }}
        onDismiss={(id) => setNotices((list) => list.filter((item) => item.id !== id))}
      />

      {choosing && <Briefing view={view} busy={busy} send={send} summary={summary} />}
      {reportOpen && view.completion && (
        <Report
          view={view}
          busy={busy}
          exitHref="/"
          onClose={() => setReportOpen(false)}
          onRestart={async () => {
            if (await send({ op: "restart" })) {
              setReportOpen(false);
              setWindows({});
              setFocused(null);
              setRead(new Set());
              lastStage.current = null;
            }
          }}
        />
      )}
    </div>
  );
}
