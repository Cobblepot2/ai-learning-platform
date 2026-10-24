"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects/runtime";
import { Avatar } from "../icons";
import type { Send } from "../config";
import { mailbox } from "../mail";

export function MailApp({
  view,
  busy,
  send,
  read,
  onRead,
}: {
  view: ProjectView;
  busy: boolean;
  send: Send;
  read: Set<string>;
  onRead: (id: string) => void;
}) {
  const mails = mailbox(view);
  const [selected, setSelected] = useState<string | null>(null);
  const open = mails.find((mail) => mail.id === selected) ?? null;
  const deciding = view.stage.id === "inbox" && view.status === "active";

  return (
    <div className="flex h-full min-h-0 text-[13px]">
      <nav className="hidden w-40 shrink-0 border-r border-black/10 bg-stone-100/70 p-2 sm:block">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold text-stone-400">Mailboxes</p>
        <p className="flex items-center justify-between rounded-md bg-black/5 px-2 py-1 font-medium text-stone-800">
          Inbox
          <span className="tabular-nums text-stone-500">{mails.filter((mail) => !read.has(mail.id)).length || ""}</span>
        </p>
      </nav>
      <ul className={`min-h-0 w-full shrink-0 overflow-y-auto border-r border-black/10 sm:w-72 ${open ? "hidden sm:block" : ""}`}>
        {mails.map((mail) => {
          const unread = !read.has(mail.id);
          return (
            <li key={mail.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(mail.id);
                  onRead(mail.id);
                }}
                className={`flex w-full gap-2 border-b border-black/5 px-3 py-2.5 text-left ${
                  selected === mail.id ? "bg-blue-500 text-white" : "hover:bg-black/5"
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? (selected === mail.id ? "bg-white" : "bg-blue-500") : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{mail.from}</span>
                    <span className={`shrink-0 text-[11px] ${selected === mail.id ? "text-white/80" : "text-stone-400"}`}>{mail.time}</span>
                  </span>
                  <span className="block truncate">{mail.subject}</span>
                  <span className={`block truncate ${selected === mail.id ? "text-white/80" : "text-stone-500"}`}>{mail.body.split("\n")[0]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <article className={`min-w-0 flex-1 overflow-y-auto ${open ? "" : "hidden sm:block"}`}>
        {open ? (
          <div className="p-5">
            <button type="button" onClick={() => setSelected(null)} className="mb-3 text-blue-600 sm:hidden">‹ Inbox</button>
            <div className="flex items-start gap-3 border-b border-black/10 pb-4">
              <Avatar initials={open.initials} tone={open.tone} size={40} />
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">{open.from}</p>
                <p className="text-stone-500">{open.kind === "ticket" ? "Support ticket" : "To: you"} · {open.time}</p>
                <p className="mt-1 text-[15px] font-semibold text-stone-900">{open.subject}</p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-stone-800">{open.body}</p>

            {deciding && open.id === "grace-email" && (
              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-semibold text-stone-900">How do you respond?</p>
                <p className="mt-0.5 text-stone-600">Your first move sets the tone with the client. There&apos;s no undo.</p>
                <div className="mt-3 grid gap-2">
                  {view.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void send({ op: "choose", actionId: action.id })}
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-left font-medium text-stone-800 shadow-sm hover:border-blue-400 disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {deciding && open.id !== "grace-email" && (
              <p className="mt-6 text-stone-500">Read everything, then reply to Grace&apos;s email.</p>
            )}
          </div>
        ) : (
          <p className="grid h-full place-items-center text-stone-400">No message selected</p>
        )}
      </article>
    </div>
  );
}
