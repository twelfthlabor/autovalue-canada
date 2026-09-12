"use client";

import { useRef } from "react";
import type { MouseEvent } from "react";

/**
 * Decorative homepage hero illustration. All figures are a static sample —
 * the live valuation renders in ValuationWorkbench (#check) below.
 */
export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--hero-px", x.toFixed(3));
    el.style.setProperty("--hero-py", y.toFixed(3));
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--hero-px", "0");
    el.style.setProperty("--hero-py", "0");
  }

  return (
    <div
      ref={ref}
      className="hero-visual"
      aria-hidden="true"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="hero-orb hero-orb-a" />
      <div className="hero-orb hero-orb-b" />
      <div className="hero-gridlines" />

      <div className="hero-layer hero-layer-main">
        <div className="hero-card hero-float-main">
          <div className="hero-card-shine" />
          <div className="hero-card-top">
            <span className="hero-kicker">ML market value</span>
            <span className="hero-sample">Sample</span>
          </div>
          <strong className="hero-value">$24,800</strong>
          <div className="hero-band">
            <div className="hero-band-track" />
            <div className="hero-band-typical" />
            <span className="hero-band-median" />
            <span className="hero-band-asking" />
          </div>
          <div className="hero-band-labels">
            <span>P10 · $21,400</span>
            <span className="hero-emphasis">Median · $24,800</span>
            <span>P90 · $28,900</span>
          </div>
          <svg className="hero-spark" viewBox="0 0 160 44" focusable="false">
            <path
              className="hero-spark-area"
              d="M2 36 C 22 34, 30 27, 48 28 S 74 33, 92 24 S 126 10, 158 13 L158 44 L2 44 Z"
            />
            <path
              className="hero-spark-line"
              d="M2 36 C 22 34, 30 27, 48 28 S 74 33, 92 24 S 126 10, 158 13"
            />
            <circle className="hero-spark-dot" cx="158" cy="13" r="3" />
          </svg>
          <div className="hero-legend">
            <span><i className="hero-dot hero-dot-typical" />P10–P90 typical</span>
            <span><i className="hero-dot hero-dot-median" />Median</span>
            <span><i className="hero-dot hero-dot-asking" />Ask</span>
          </div>
        </div>
      </div>

      <div className="hero-layer hero-layer-pill">
        <div className="hero-pill hero-float-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 17l5.5-6 4 3.5L20.5 7" />
            <path d="M15.5 7h5v5" />
          </svg>
          <span>Ask $26,500 · <b>+6.9% vs estimate</b></span>
        </div>
      </div>

      <div className="hero-layer hero-layer-chip">
        <div className="hero-chip hero-float-chip">
          <span className="hero-pulse"><i /></span>
          <span>180,833 vehicles · 5,605 cells</span>
        </div>
      </div>
    </div>
  );
}
