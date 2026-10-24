"use client";

import { useRef } from "react";

export type WindowFrame = { x: number; y: number; w: number; h: number };

/**
 * A macOS-style window. Dragging the title bar moves it; the traffic lights close,
 * minimise to the Dock and zoom. On small screens every window fills the screen.
 */
export function Window({
  title,
  frame,
  z,
  focused,
  zoomed,
  compact,
  onFocus,
  onMove,
  onClose,
  onMinimise,
  onZoom,
  children,
}: {
  title: string;
  frame: WindowFrame;
  z: number;
  focused: boolean;
  zoomed: boolean;
  compact: boolean;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
  onMinimise: () => void;
  onZoom: () => void;
  children: React.ReactNode;
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const full = zoomed || compact;

  function startDrag(event: React.PointerEvent) {
    if (full || (event.target as HTMLElement).closest("button")) return;
    drag.current = { dx: event.clientX - frame.x, dy: event.clientY - frame.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent) {
    if (!drag.current) return;
    const x = Math.max(-frame.w + 120, Math.min(window.innerWidth - 120, event.clientX - drag.current.dx));
    const y = Math.max(28, Math.min(window.innerHeight - 80, event.clientY - drag.current.dy));
    onMove(x, y);
  }
  function endDrag() {
    drag.current = null;
  }

  return (
    <section
      role="dialog"
      aria-label={title}
      onPointerDown={onFocus}
      className={`absolute flex flex-col overflow-hidden border bg-white/95 backdrop-blur-xl transition-shadow ${
        full ? "rounded-none sm:rounded-xl" : "rounded-xl"
      } ${focused ? "border-black/15 shadow-[0_22px_70px_rgba(0,0,0,0.35)]" : "border-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"}`}
      style={
        full
          ? { left: compact ? 0 : 8, top: compact ? 28 : 34, right: compact ? 0 : 8, bottom: compact ? 76 : 92, zIndex: z }
          : { left: frame.x, top: frame.y, width: frame.w, height: frame.h, zIndex: z }
      }
    >
      <header
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => !compact && onZoom()}
        className={`relative flex h-10 shrink-0 select-none items-center border-b border-black/10 px-3 ${
          focused ? "bg-gradient-to-b from-stone-100 to-stone-200/80" : "bg-stone-100/80"
        } ${full ? "" : "cursor-default"}`}
      >
        <div className="group flex gap-2">
          <Light color="bg-[#ff5f57]" label="Close" symbol="×" onClick={onClose} active={focused} />
          <Light color="bg-[#febc2e]" label="Minimise" symbol="−" onClick={onMinimise} active={focused} />
          <Light color="bg-[#28c840]" label={zoomed ? "Restore size" : "Zoom"} symbol="+" onClick={onZoom} active={focused} disabled={compact} />
        </div>
        <p className={`pointer-events-none absolute inset-x-24 truncate text-center text-[13px] font-medium ${focused ? "text-stone-700" : "text-stone-400"}`}>
          {title}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

function Light({
  color,
  label,
  symbol,
  onClick,
  active,
  disabled,
}: {
  color: string;
  label: string;
  symbol: string;
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`grid h-3 w-3 place-items-center rounded-full text-[9px] font-bold leading-none text-black/60 ring-1 ring-black/10 ${
        active ? color : "bg-stone-300"
      } disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
    >
      <span className="opacity-0 group-hover:opacity-100">{symbol}</span>
    </button>
  );
}
