import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const heroVisual = readFileSync("components/hero-visual.tsx", "utf8");
const manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));

describe("animated landing hero contract", () => {
  it("manifest values format to the ticker figures (5,605 / 180,833)", () => {
    expect(manifest.usedMarketCells).toBe(5605);
    expect(manifest.usedVehiclesRepresented).toBe(180833);
    expect(manifest.usedMarketCells.toLocaleString("en-CA")).toBe("5,605");
    expect(manifest.usedVehiclesRepresented.toLocaleString("en-CA")).toBe("180,833");
  });

  it("wires the CTA anchor to #check", () => {
    expect(page).toContain('href="#check"');
    expect(page).toMatch(/className="hero-cta"/);
    expect(page).toMatch(/Check this price/);
  });

  it("renders the ticker from manifest values (no fetch)", () => {
    expect(page).toContain("manifest.usedMarketCells");
    expect(page).toContain("manifest.usedVehiclesRepresented");
    expect(page).toMatch(/hero-ticker/);
    expect(page).toMatch(/US wholesale temporal-test MAE \$/);
  });

  it("defines hero-* keyframes", () => {
    for (const name of [
      "hero-float",
      "hero-orb-drift",
      "hero-marquee",
      "hero-shimmer",
      "hero-ping",
      "hero-band-grow",
    ]) {
      expect(css).toContain(`@keyframes ${name}`);
    }
  });

  it("opts hero animations out under prefers-reduced-motion", () => {
    const blocks = css.split("@media (prefers-reduced-motion: reduce)");
    expect(blocks.length).toBeGreaterThan(1);
    const heroBlock = blocks.slice(1).join("\n");
    expect(heroBlock).toContain(".hero-ticker-track");
    expect(heroBlock).toContain(".hero-visual");
    expect(heroBlock).toMatch(/animation:\s*none/);
  });

  it("keeps the hero visual decorative and labelled as a sample", () => {
    expect(heroVisual).toContain('aria-hidden="true"');
    expect(heroVisual).toContain("hero-visual");
    expect(heroVisual).toContain("hero-card");
    expect(heroVisual).toMatch(/Sample/);
  });
});
