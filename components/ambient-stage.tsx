"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

const WaveScene = dynamic(() => import("@/components/scenes").then((module) => module.WaveScene), { ssr: false });
const GlobeScene = dynamic(() => import("@/components/scenes").then((module) => module.GlobeScene), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

let webglSupport: boolean | undefined;
function webglAvailable() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const subscribeNever = () => () => {};

/** Decorative WebGL only mounts when supported; it renders one still frame
    under reduced motion and stops drawing whenever it is off screen. */
function useSceneState(ref: RefObject<HTMLElement | null>) {
  const supported = useSyncExternalStore(subscribeNever, webglAvailable, () => false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return { supported, running: inView && !reduced };
}

/**
 * Full-bleed dark stage behind the header. Its height follows the element
 * marked `data-stage-anchor` on the current page (a fraction of the workbench
 * on the home page, the whole report header on research pages), so the fold
 * lands in the same place at every breakpoint.
 */
export function AmbientStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { supported, running } = useSceneState(stageRef);

  useEffect(() => {
    const stage = stageRef.current;
    const anchor = document.querySelector<HTMLElement>("[data-stage-anchor]");
    if (!stage || !anchor) { stage?.style.removeProperty("--stage-h"); return; }
    const cover = Number(anchor.dataset.stageAnchor) || 1;
    const apply = () => {
      // offsetTop ignores the entrance transforms that are still in flight.
      let top = 0;
      for (let node: HTMLElement | null = anchor; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
      const height = anchor.offsetHeight;
      const covered = cover >= 1 ? height + 20 : Math.min(height * cover, 280);
      stage.style.setProperty("--stage-h", `${Math.round(top + covered)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(anchor);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div ref={stageRef} className="stage" aria-hidden="true">
      <div className="stage-aurora" />
      <div className="stage-grid" />
      {supported ? <SceneBoundary><WaveScene running={running} /></SceneBoundary> : null}
      <div className="stage-fade" />
    </div>
  );
}

export function GlobeStage({ provinces }: { provinces: Array<{ code: string; share: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const { supported, running } = useSceneState(ref);
  return (
    <div ref={ref} className="globe-stage" aria-hidden="true">
      <div className="globe-fallback" />
      {supported ? <SceneBoundary><GlobeScene running={running} provinces={provinces} /></SceneBoundary> : null}
    </div>
  );
}
