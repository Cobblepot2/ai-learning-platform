"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades an element up the first time it scrolls into view.
 *
 * Apply it to the glass element itself, never to a wrapper around one: an
 * ancestor with opacity below 1 becomes the backdrop root, so the glass blurs
 * nothing until the fade ends and the blur appears to pop in late.
 */
export function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    style: { transitionDelay: shown ? `${delay}ms` : "0ms" },
    className: `transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none ${
      shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"
    }`,
  };
}

/** A block that reveals on scroll. Pass glass classes in className so the fade sits on the glass itself. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const reveal = useReveal<HTMLDivElement & HTMLLIElement>(delay);
  return (
    <Tag ref={reveal.ref} style={reveal.style} className={`${reveal.className} ${className}`}>
      {children}
    </Tag>
  );
}
