"use client";

import { animate, stagger } from "animejs";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs `start` once, the first time the element scrolls into view. */
function useFirstView<T extends HTMLElement>(start: (element: T) => void | (() => void), prepare?: (element: T) => void) {
  const ref = useRef<T>(null);
  const startRef = useRef(start);
  const prepareRef = useRef(prepare);
  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReduced()) return;
    if (element.getBoundingClientRect().top > window.innerHeight) prepareRef.current?.(element);
    let cleanup: void | (() => void);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      cleanup = startRef.current(element);
    }, { threshold: .2 });
    observer.observe(element);
    return () => { observer.disconnect(); if (cleanup) cleanup(); };
  }, []);
  return ref;
}

/**
 * The server renders the final artifact value, so no-JS and reduced-motion
 * readers see the real number; the count-up only replays it on first view.
 */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const format = (current: number) => `${prefix}${current.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const ref = useFirstView<HTMLSpanElement>((element) => {
    const counter = { current: 0 };
    const animation = animate(counter, { current: value, duration: 1600, ease: "out(4)", onUpdate: () => { element.textContent = format(counter.current); }, onComplete: () => { element.textContent = format(value); } });
    return () => { animation.revert(); element.textContent = format(value); };
  }, (element) => { element.textContent = format(0); });
  return <span ref={ref} className="count-up">{format(value)}</span>;
}

/** Staggers the direct children marked `data-reveal` into place on first view. */
export function Reveal({ children, className, as: Tag = "div", style }: { children: ReactNode; className?: string; as?: "div" | "section" | "dl" | "ul"; style?: CSSProperties }) {
  const ref = useFirstView<HTMLElement>((element) => {
    const targets = element.querySelectorAll<HTMLElement>("[data-reveal]");
    const animation = animate(targets, { opacity: [0, 1], translateY: [18, 0], filter: ["blur(6px)", "blur(0px)"], duration: 760, delay: stagger(70), ease: "out(4)" });
    return () => { animation.revert(); };
  }, (element) => element.querySelectorAll<HTMLElement>("[data-reveal]").forEach((target) => { target.style.opacity = "0"; }));
  return <Tag ref={ref as never} className={className} style={style}>{children}</Tag>;
}

/** Pointer-tracked radial highlight shared by every `.spotlight-card` inside. */
export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const move = (event: PointerEvent) => {
      root.querySelectorAll<HTMLElement>(".spotlight-card").forEach((card) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    };
    root.addEventListener("pointermove", move, { passive: true });
    return () => root.removeEventListener("pointermove", move);
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
