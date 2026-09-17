import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const workbench = readFileSync("components/valuation-workbench.tsx", "utf8");

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const srgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = srgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

describe("valuation distribution and research layout contracts", () => {
  it("keeps the research header in normal flow", () => {
    const innerRule = css.match(/(^|[\n])\.report-header\s*\{[^}]*\}/);
    expect(innerRule).not.toBeNull();
    expect(innerRule![0]).not.toMatch(/position\s*:/);
  });

  it("flags close median/ask labels with .band-close (<14pp spread)", () => {
    expect(workbench).toContain("band-close");
    expect(workbench).toContain("labelsClose");
    expect(workbench).toMatch(/<\s*14/);
    expect(workbench).toMatch(/price-band\$\{labelsClose/);
    // Exact coincidence (<2pp) gets the stronger z-order path.
    expect(workbench).toContain("labelsExact");
    expect(workbench).toContain("band-exact");
    expect(workbench).toContain("data-band-pos");
    // The displacement classes are gone from the component.
    expect(workbench).not.toContain("band-ask-left");
    expect(workbench).not.toContain("band-edge");
    expect(workbench).not.toContain("translateX(-100%)");
  });

  it("centers dots, labels and captions on the value scale (no displacement offsets)", () => {
    // Dots recenter with -50% only; no margin nudges, no ticks.
    expect(css).toMatch(/\.band-median\s*\{[^}]*transform:\s*translateX\(-50%\)/);
    expect(css).toMatch(/\.band-asking\s*\{[^}]*transform:\s*translateX\(-50%\)/);
    expect(css).not.toMatch(/\.band-(?:median|asking)[^{}]*\{[^}]*margin-left/);
    expect(css).not.toContain(".price-band.band-close .band-median::after");
    expect(css).not.toContain(".price-band.band-close .band-asking::after");
    expect(css).not.toContain(".band-ask-left");
    expect(css).not.toContain(".band-edge");
    // Labels opt into the measured shift contract instead of side-by-side flips.
    expect(css).toMatch(/\.band-median i\s*\{[^}]*translateX\(calc\(-50% \+ var\(--band-shift, 0px\)\)\)/);
    expect(css).toMatch(/\.band-asking i\s*\{[^}]*translateX\(calc\(-50% \+ var\(--band-shift, 0px\)\)\)/);
    // Captions are absolutely positioned on the same percent scale.
    expect(css).toMatch(/\.band-caption\s*\{[^}]*position:\s*relative/);
    expect(css).toMatch(/\.band-caption span\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.band-caption span\s*\{[^}]*translateX\(calc\(-50% \+ var\(--band-shift, 0px\)\)\)/);
    expect(css).toMatch(/\.band-caption span\s*\{[^}]*top:\s*calc\(var\(--band-row, 0\) \* var\(--band-row-h, \d+px\)\)/);
    // Split callout sides: the ask callout hangs above its dot, the median
    // callout below its dot, so close/exact states never need a vertical stack.
    expect(css).toMatch(/\.band-asking i\s*\{[^}]*bottom:\s*calc\(100% \+ var\(--band-callout-gap/);
    expect(css).toMatch(/\.band-median i\s*\{[^}]*top:\s*calc\(100% \+ var\(--band-callout-gap/);
    // Exact coincidence paints the 17px ink median above the 21px accent ask disc.
    expect(css).toMatch(/\.band-exact\s+\.band-median\s*\{[^}]*z-index:\s*2/);
  });

  it("links callouts to their dots with visible measured connector geometry", () => {
    // The component measures the dot/label boxes after writing --band-shift and
    // derives each decorative connector's y/length/angle from them.
    expect(workbench).toContain("band-link");
    expect(workbench).toContain("--band-link-length");
    expect(workbench).toContain("--band-link-angle");
    expect(workbench).toContain("--band-link-y");
    expect(workbench).toContain("--band-link-embed");
    expect(workbench).toContain("--band-link-sibling-embed");
    expect(workbench).not.toContain("--band-label-stack");
    // Sibling avoidance comes from settled declared value positions, never the
    // dots' live `left` rect (a re-measure can land while the spring is moving).
    expect(workbench).toContain("declaredCenterX");
    expect(workbench).toMatch(/offsetX = declaredCenterX\(position\) - declaredCenterX\(siblingEntry\.position\)/);
    expect(css).toMatch(/\.band-link\s*\{[^}]*top:\s*var\(--band-link-y/);
    expect(css).toMatch(/\.band-link\s*\{[^}]*width:\s*var\(--band-link-length/);
    expect(css).toMatch(/\.band-link\s*\{[^}]*height:\s*var\(--band-link-thickness\)/);
    expect(css).toMatch(/\.band-link\s*\{[^}]*rotate\(var\(--band-link-angle/);
    // Solid dot tokens (no translucent tint) reach >=3:1 on the band background
    // so the 2px connector is visible at 100% zoom.
    expect(css).toMatch(/\.band-asking \.band-link\s*\{[^}]*background:\s*var\(--accent\)/);
    expect(css).toMatch(/\.band-median \.band-link\s*\{[^}]*background:\s*var\(--ink\)/);
    const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? "";
    const contrastOn = (a: string, b: string) => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    expect(contrastOn(token("accent"), token("surface-3"))).toBeGreaterThanOrEqual(3);
    expect(contrastOn(token("ink"), token("surface-3"))).toBeGreaterThanOrEqual(3);
    // Callout displacement stays on the measured shift only.
    expect(css).toMatch(/\.band-median i\s*\{[^}]*translateX\(calc\(-50% \+ var\(--band-shift, 0px\)\)\)/);
    expect(css).toMatch(/\.band-asking i\s*\{[^}]*translateX\(calc\(-50% \+ var\(--band-shift, 0px\)\)\)/);
  });

  it("uses a 5-col lab-stats grid (no 4+1 orphan)", () => {
    expect(css).toMatch(/\.lab-stats\s*\{[^}]*repeat\(5,\s*1fr\)/);
    expect(css).not.toMatch(/\.lab-stats\s*\{[^}]*repeat\(4,\s*1fr\)/);
    // 681-1100px 2-col must allow wrapping (was nowrap squeeze until 680px).
    // Isolate the 1100 block (exclude the later 680 block which already wraps).
    const after1100 = css.split("@media (max-width: 1100px)").slice(1).join("\n");
    const midBlock = after1100.split("@media")[0];
    expect(midBlock).toMatch(/\.lab-stats\s+span\s*\{[^}]*white-space:\s*normal/);
  });

});

describe("valuation sheet presence", () => {
  it("keeps the ml-estimate workbench present", () => {
    expect(workbench).toContain('data-testid="ml-estimate"');
    expect(workbench).toMatch(/ML estimate/);
  });
});
