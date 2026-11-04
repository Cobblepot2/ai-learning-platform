"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { play, readSoundSetting, unlockSound, writeSoundSetting } from "@/lib/sound";
import type { ProjectView } from "@/lib/projects/runtime";
import { appName, appTitle, DOCK, STAGE_APP, nextStep, type AppId, type Op } from "./config";
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
import { useDesktopSounds } from "./useDesktopSounds";

type WindowState = { open: boolean; minimised: boolean; zoomed: boolean; z: number; frame: WindowFrame };

const WALLPAPER = {
  background:
    "radial-gradient(120% 80% at 15% 110%, #f59e0b 0%, rgba(245,158,11,0) 45%), radial-gradient(90% 70% at 85% 105%, #db2777 0%, rgba(219,39,119,0) 50%), radial-gradient(120% 90% at 50% -10%, #1e3a8a 0%, rgba(30,58,138,0) 60%), linear-gradient(180deg, #312e81 0%, #7c3aed 45%, #f472b6 100%)",
};

// Mail arrives one message at a time, each with a banner, so none is missed.
const FIRST_MAIL_DELAY = 800;
const MAIL_GAP = 2500;

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
  exit = { href: "/", label: "Leave the desktop" },
}: {
  scenarioId: string;
  title: string;
  summary: string;
  /** Where the report's way out leads: home, or back to the learning path this project is a step of. */
  exit?: { href: string; label: string };
}) {
  const { ready, user } = useAuth();
  const [view, setView] = useState<ProjectView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [windows, setWindows] = useState<Partial<Record<AppId, WindowState>>>({});
  const [focused, setFocused] = useState<AppId | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  // Mail the learner has received. null until the first view decides what already arrived.
  const [delivered, setDelivered] = useState<Set<string> | null>(null);
  const [mailSelected, setMailSelected] = useState<string | null>(null);
  // The stage whose app the learner has opened; until then its Dock icon asks for attention.
  const [attended, setAttended] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  // Seven Dock icons need smaller ones to fit a phone.
  const [narrow, setNarrow] = useState(false);
  const [sound, setSound] = useState(true);
  const zTop = useRef(10);
  const noticeId = useRef(0);
  const lastStage = useRef<string | null>(null);
  const stageApp = useRef<AppId | null>(null);
  const lastDelivery = useRef(0);
  const windowsNow = useRef(windows);

  useEffect(() => {
    windowsNow.current = windows;
  }, [windows]);

  // Browsers keep audio locked until the learner clicks or types once.
  useEffect(() => {
    setSound(readSoundSetting());
    window.addEventListener("pointerdown", unlockSound);
    window.addEventListener("keydown", unlockSound);
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, []);

  useDesktopSounds(view);

  useEffect(() => {
    const update = () => {
      setCompact(window.innerWidth < 900);
      setNarrow(window.innerWidth < 400);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // At most one sticky banner (the next step) plus the three latest others.
  const notify = useCallback((notice: Omit<Notice, "id">) => {
    const id = ++noticeId.current;
    // Mail gets the notification chime; a "Next step" banner waits for the action's own cue; only errors have no app.
    play(notice.app === "mail" && !notice.sticky ? "mail" : notice.app ? "nudge" : "error", notice.sticky ? 0.4 : 0);
    setNotices((list) => {
      const sticky = list.filter((item) => item.sticky && !notice.sticky);
      const others = list.filter((item) => !item.sticky).slice(notice.sticky ? -3 : -2);
      return [...sticky, ...others, { ...notice, id }];
    });
    if (!notice.sticky) window.setTimeout(() => setNotices((list) => list.filter((item) => item.id !== id)), 7000);
  }, []);

  const openApp = useCallback((app: AppId) => {
    const current = windowsNow.current[app];
    if (!current?.open || current.minimised) play("open");
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
    if (app === stageApp.current) {
      setAttended(lastStage.current);
      setNotices((list) => list.filter((item) => !item.sticky));
    }
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

  // A new stage never opens an app by itself: a banner and the Dock say what to open.
  useEffect(() => {
    if (!view) return;
    const stage = view.status === "completed" ? "completed" : view.stage.id;
    if (stage === lastStage.current) return;
    lastStage.current = stage;
    setAttended(null);
    setNotices((list) => list.filter((item) => !item.sticky));
    if (stage === "completed") {
      stageApp.current = null;
      setReportOpen(true);
      return;
    }
    const app = STAGE_APP[view.stage.id] ?? null;
    stageApp.current = app;
    const step = nextStep(view);
    if (app && step) notify({ app, title: "Next step", body: step, sticky: true });
  }, [view, notify]);

  // On the first view, mail that already arrived in an earlier visit is not replayed.
  useEffect(() => {
    if (!view || delivered) return;
    const fresh = view.stage.id === "choose-track" && view.status === "active";
    setDelivered(new Set(fresh ? [] : mailbox(view).map((mail) => mail.id)));
  }, [view, delivered]);

  // Deliver the oldest waiting message, then the next after a gap.
  useEffect(() => {
    if (!view || !delivered || (view.stage.id === "choose-track" && view.status === "active")) return;
    const waiting = mailbox(view).reverse().filter((mail) => !delivered.has(mail.id));
    const mail = waiting[0];
    if (!mail) return;
    const gap = delivered.size ? MAIL_GAP : FIRST_MAIL_DELAY;
    const timer = window.setTimeout(() => {
      lastDelivery.current = Date.now();
      setDelivered((set) => new Set(set).add(mail.id));
      notify({ app: "mail", mailId: mail.id, title: mail.from, body: mail.subject });
    }, Math.max(FIRST_MAIL_DELAY, gap - (Date.now() - lastDelivery.current)));
    return () => window.clearTimeout(timer);
  }, [view, delivered, notify]);

  const selectMail = useCallback((id: string | null) => {
    setMailSelected(id);
    if (id) setRead((set) => new Set(set).add(id));
  }, []);

  if (!ready || !user || !view) {
    return (
      <div className="grid h-full place-items-center p-4 text-stone-900" style={WALLPAPER}>
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

  const mails = mailbox(view).filter((mail) => delivered?.has(mail.id));
  const unreadMail = mails.filter((mail) => !read.has(mail.id)).length;
  const choosing = view.stage.id === "choose-track" && view.status === "active";
  const needed = view.status === "active" && !choosing ? STAGE_APP[view.stage.id] : null;
  // The app the learner should open next, until they open it.
  const attention = needed && attended !== view.stage.id ? needed : null;
  const step = choosing ? null : nextStep(view);
  const day = Math.min(view.meters.effortMax, view.meters.effort + 1);

  function renderApp(app: AppId) {
    if (!view) return null;
    switch (app) {
      case "mail":
        return <MailApp view={view} busy={busy} send={send} mails={mails} read={read} selected={mailSelected} onSelect={selectMail} />;
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

  // The site's default text is light for the dark public pages; the desktop's
  // windows are light, so it sets its own dark default.
  return (
    <div className="relative h-full overflow-hidden font-sans text-stone-900" style={WALLPAPER}>
      {/* Menu bar */}
      <header className="absolute inset-x-0 top-0 z-[960] flex h-7 items-center gap-4 bg-white/40 px-3 text-[13px] text-stone-900 backdrop-blur-xl">
        <Link href="/" aria-label="Leave the desktop and return to DevPath" className="font-bold tracking-tight">◆</Link>
        <span className="font-semibold">{focused ? appName(focused, view) : "Finder"}</span>
        {step && needed ? (
          <button
            type="button"
            onClick={() => openApp(needed)}
            className="min-w-0 truncate rounded px-1.5 text-stone-800 hover:bg-white/50"
            title="Open the app for the next step"
          >
            <span className="font-semibold text-blue-700">Next:</span> {step}
          </button>
        ) : (
          <span className="hidden truncate text-stone-700 sm:inline">{view.scenario.title}</span>
        )}
        <button
          type="button"
          onClick={() => {
            writeSoundSetting(!sound);
            setSound(!sound);
          }}
          aria-label={sound ? "Mute sounds" : "Turn sounds on"}
          aria-pressed={!sound}
          title={sound ? "Mute sounds" : "Turn sounds on"}
          className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-stone-800 hover:bg-white/50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            {sound ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
          </svg>
        </button>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-stone-800">
          {view.status === "completed" ? "Job finished" : `Day ${day} of ${view.meters.effortMax}`}
        </span>
        <span className="hidden shrink-0 whitespace-nowrap tabular-nums text-stone-800 sm:inline">Trust {view.meters.trust}/10</span>
      </header>

      <ProjectWidget view={view} onOpenApp={openApp} />

      {DOCK.map((app) => {
        const state = windows[app];
        if (!state?.open) return null;
        // Keep minimised apps mounted so their unsubmitted drafts survive.
        return (
          <Window
            key={app}
            title={appTitle(app, view)}
            frame={state.frame}
            z={state.z}
            focused={focused === app}
            zoomed={state.zoomed}
            compact={compact}
            minimised={state.minimised}
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
        {/* No overflow clipping here: bouncing icons, badges and tooltips rise above the bar.
            Six compact icons fit a 320px screen with the smaller gap. */}
        <ul className="flex items-end gap-1.5 rounded-[22px] border border-white/40 bg-white/30 px-2.5 pb-1.5 pt-2 shadow-2xl backdrop-blur-2xl sm:gap-2">
          {DOCK.map((app) => {
            const running = windows[app]?.open;
            const badge = app === "mail" ? unreadMail : app === attention ? 1 : 0;
            return (
              <li key={app} className="relative">
                <button
                  type="button"
                  onClick={() => openApp(app)}
                  aria-label={`${appName(app, view)}${badge ? `, ${badge} new` : ""}`}
                  className={`group flex flex-col items-center transition-transform duration-150 hover:-translate-y-2 motion-reduce:transition-none ${
                    // The hover lift (translate) and the bounce (transform) would add up, so a
                    // hovered icon stops bouncing and just lifts like the others.
                    app === attention ? "animate-[dock-attention_3s_ease-in-out_infinite] hover:animate-none motion-reduce:animate-none" : ""
                  }`}
                >
                  <span className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded-md bg-stone-800/80 px-2 py-0.5 text-[12px] text-white group-hover:block">{appName(app, view)}</span>
                  <AppIcon app={app} size={narrow ? 34 : compact ? 42 : 50} />
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
          if (notice.mailId) selectMail(notice.mailId);
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
          exit={exit}
          onClose={() => setReportOpen(false)}
          onRestart={async () => {
            if (await send({ op: "restart" })) {
              setReportOpen(false);
              setWindows({});
              setFocused(null);
              setRead(new Set());
              setDelivered(new Set());
              setMailSelected(null);
              setNotices([]);
              lastStage.current = null;
            }
          }}
        />
      )}
    </div>
  );
}
