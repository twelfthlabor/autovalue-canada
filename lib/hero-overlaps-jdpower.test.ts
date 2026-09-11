import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const workbench = readFileSync("components/valuation-workbench.tsx", "utf8");

/** WCAG 2.x relative luminance + contrast ratio (white background). */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const srgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = srgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastOnWhite(hex: string): number {
  const l = luminance(hex);
  return (1.05) / (l + 0.05);
}

describe("hero overlap fixes (fix/hero-overlaps-jdpower-theme)", () => {
  it("scopes the landing hero-card to .hero-visual (no global absolute leak)", () => {
    // Landing card must be scoped so inner-page .hero-card is unaffected.
    expect(css).toContain(".hero-visual .hero-card");
    // The absolute-positioned landing card only appears in scoped form.
    const scopedAbsolute = (css.match(/\.hero-visual\s+\.hero-card\s*\{[^}]*position:\s*absolute/g) ?? []).length;
    expect(scopedAbsolute).toBeGreaterThanOrEqual(1);
    // No bare `.hero-card { ... position:absolute ... }` rule may remain.
    expect(css).not.toMatch(/(^|[\n;}])\s*\.hero-card\s*\{[^}]*position:\s*absolute/);
  });

  it("keeps the inner-page .hero-card static (in-flow aside)", () => {
    const innerRule = css.match(/(^|[\n])\.hero-card\s*\{[^}]*\}/);
    expect(innerRule).not.toBeNull();
    expect(innerRule![0]).not.toMatch(/position\s*:/);
  });

  it("flags close median/ask labels with .band-close (<14pp spread)", () => {
    expect(workbench).toContain("band-close");
    expect(workbench).toContain("labelsClose");
    expect(workbench).toMatch(/<\s*14/);
    expect(workbench).toMatch(/price-band\$\{labelsClose/);
    // Exact coincidence (<2pp) gets stronger dot-nudge handling.
    expect(workbench).toContain("labelsExact");
    expect(workbench).toContain("band-exact");
    expect(workbench).toContain("band-edge");
    expect(css).toContain(".price-band.band-close .band-median i");
    expect(css).toContain(".price-band.band-close .band-asking i");
    // -100%/0% side-by-side (not -92%/-8% inset that left ~8px overlap at 0pp).
    expect(css).toMatch(/\.price-band\.band-close\s+\.band-median\s+i\s*\{[^}]*translateX\(-100%/);
    expect(css).toMatch(/\.price-band\.band-close\s+\.band-asking\s+i\s*\{[^}]*translateX\(0/);
    // Ticks live on the dots (dot center) so they stay pointed after shift.
    expect(css).toContain(".price-band.band-close .band-median::after");
    expect(css).toContain(".price-band.band-close .band-asking::after");
    // Dot nudge separates 17px/21px discs at coincidence.
    expect(css).toMatch(/\.price-band\.band-close[^{]*\.band-median\s*\{[^}]*margin-left:\s*-/);
  });

  it("mirrors the close spread when the ask sits below the median", () => {
    // Direction comes from the projected positions, not the raw dollars.
    expect(workbench).toMatch(/askPos\s*<\s*medianPos/);
    expect(workbench).toContain("band-ask-left");
    // Ask-left: median label shifts right, ask label shifts left (away from each other).
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\s+\.band-median\s+i\s*\{[^}]*translateX\(0/);
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\s+\.band-asking\s+i\s*\{[^}]*translateX\(-100%/);
    // Dot nudges invert so the discs separate instead of converge.
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\s+\.band-median\s*\{[^}]*margin-left:\s*6px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\s+\.band-asking\s*\{[^}]*margin-left:\s*-6px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-exact\.band-ask-left\s+\.band-median\s*\{[^}]*margin-left:\s*10px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-exact\.band-ask-left\s+\.band-asking\s*\{[^}]*margin-left:\s*-10px/);
    // Edge guard mirrors too: the dot nearest the panel edge keeps zero offset.
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\.band-edge-l\s+\.band-median\s*\{[^}]*margin-left:\s*12px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\.band-edge-l\s+\.band-asking\s*\{[^}]*margin-left:\s*0/);
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\.band-edge-r\s+\.band-median\s*\{[^}]*margin-left:\s*0/);
    expect(css).toMatch(/\.price-band\.band-close\.band-ask-left\.band-edge-r\s+\.band-asking\s*\{[^}]*margin-left:\s*-12px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-exact\.band-ask-left\.band-edge-l\s+\.band-median\s*\{[^}]*margin-left:\s*20px/);
    expect(css).toMatch(/\.price-band\.band-close\.band-exact\.band-ask-left\.band-edge-r\s+\.band-asking\s*\{[^}]*margin-left:\s*-20px/);
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

  it("keeps the mobile header in-flow (2-row grid, no 56px clamp)", () => {
    const mobileBlock = css.split("@media (max-width: 680px)").slice(1).join("\n");
    expect(mobileBlock).toContain(".site-header");
    expect(mobileBlock).toMatch(/height:\s*auto/);
    expect(mobileBlock).toMatch(/grid-template-rows/);
    expect(mobileBlock).toMatch(/grid-row:\s*2/);
    // 2-row sticky (~93px) needs deeper anchor offset than desktop 76px.
    expect(mobileBlock).toMatch(/scroll-margin-top:\s*96px/);
    // Desktop Open-data link must stay styled + right-aligned in 1fr auto 1fr.
    expect(css).toMatch(/\.nav-external\s*\{[^}]*justify-self:\s*end/);
    expect(css).toMatch(/\.nav-external\s*\{[^}]*display:\s*inline-flex/);
  });
});

describe("J.D. Power 2026 theme tokens", () => {
  it("defines brand/accent/navy tokens", () => {
    expect(css).toMatch(/--brand:\s*#00838F/i);
    expect(css).toMatch(/--brand-ink:\s*#066A75/i);
    expect(css).toMatch(/--accent:\s*#D34612/i);
    expect(css).toMatch(/--ink:\s*#102330/i);
    expect(css).toMatch(/--navy:\s*#102330/i);
    // Small teal text on tints must use the darker ink (brand 4.07 fail on bg).
    expect(css).toMatch(/\.site-header\s+nav\s+a\.active\s*\{[^}]*var\(--brand-ink\)/);
    expect(css).toMatch(/\.eyebrow\s*\{[^}]*var\(--brand-ink\)/);
    expect(contrastOnWhite("#066A75")).toBeGreaterThanOrEqual(4.5);
  });

  it("removes the legacy orange", () => {
    expect(css.toLowerCase()).not.toContain("#f04b23");
    expect(css).not.toContain("240, 75, 35");
    expect(css).not.toContain("240,75,35");
    // CTA gradient top #E4571A (3.70 fail) removed for solid AA CTA.
    expect(css.toLowerCase()).not.toContain("#e4571a");
    expect(css).toMatch(/\.hero-cta\s*\{[^}]*background:\s*var\(--accent\)/);
    expect(css).toMatch(/\.hero-cta:hover\s*\{[^}]*background:\s*var\(--accent-deep\)/);
    expect(css).toMatch(/\.check-price-button\s*\{[^}]*background:\s*var\(--accent\)/);
    expect(css).toMatch(/\.check-price-button:hover\s*\{[^}]*background:\s*var\(--accent-deep\)/);
  });

  it("uses an AA faint token (was #98a1ad ~2.7:1)", () => {
    expect(css).toMatch(/--faint:\s*#5A6B76/i);
    expect(css.toLowerCase()).not.toContain("#98a1ad");
    expect(contrastOnWhite("#5A6B76")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("valuation sheet presence", () => {
  it("keeps the ml-estimate workbench present", () => {
    expect(workbench).toContain('data-testid="ml-estimate"');
    expect(workbench).toMatch(/ML estimate/);
  });
});
