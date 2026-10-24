"use client";

import { useState } from "react";
import { glass } from "./glass";
import { useReveal } from "./Reveal";

/** Dark glass card with a soft blue light that follows the pointer. It reveals itself on scroll. */
export function SpotlightCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reveal = useReveal<HTMLDivElement>(delay);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lit, setLit] = useState(false);

  function move(event: React.PointerEvent) {
    const rect = reveal.ref.current?.getBoundingClientRect();
    if (rect) setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  return (
    <div
      ref={reveal.ref}
      style={reveal.style}
      onPointerMove={move}
      onPointerEnter={() => setLit(true)}
      onPointerLeave={() => setLit(false)}
      onFocus={() => setLit(true)}
      onBlur={() => setLit(false)}
      className={`relative overflow-hidden ${glass} ${reveal.className} ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: lit ? 0.6 : 0,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(59, 130, 246, 0.45), transparent 80%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
