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

  it("flags close median/ask labels with .band-close (<8pp spread)", () => {
    expect(workbench).toContain("band-close");
    expect(workbench).toContain("labelsClose");
    expect(workbench).toMatch(/<\s*8/);
    expect(workbench).toMatch(/price-band\$\{labelsClose/);
    expect(css).toContain(".price-band.band-close .band-median i");
    expect(css).toContain(".price-band.band-close .band-asking i");
  });

  it("uses a 5-col lab-stats grid (no 4+1 orphan)", () => {
    expect(css).toMatch(/\.lab-stats\s*\{[^}]*repeat\(5,\s*1fr\)/);
    expect(css).not.toMatch(/\.lab-stats\s*\{[^}]*repeat\(4,\s*1fr\)/);
  });

  it("keeps the mobile header in-flow (2-row grid, no 56px clamp)", () => {
    const mobileBlock = css.split("@media (max-width: 680px)").slice(1).join("\n");
    expect(mobileBlock).toContain(".site-header");
    expect(mobileBlock).toMatch(/height:\s*auto/);
    expect(mobileBlock).toMatch(/grid-template-rows/);
    expect(mobileBlock).toMatch(/grid-row:\s*2/);
  });
});

describe("J.D. Power 2026 theme tokens", () => {
  it("defines brand/accent/navy tokens", () => {
    expect(css).toMatch(/--brand:\s*#00838F/i);
    expect(css).toMatch(/--accent:\s*#D34612/i);
    expect(css).toMatch(/--ink:\s*#102330/i);
    expect(css).toMatch(/--navy:\s*#102330/i);
  });

  it("removes the legacy orange", () => {
    expect(css.toLowerCase()).not.toContain("#f04b23");
    expect(css).not.toContain("240, 75, 35");
    expect(css).not.toContain("240,75,35");
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
