import { describe, expect, it } from "vitest";
import marketData from "../public/data/market.json";
import { runCanadianCheck } from "./canadian-check";
import type { MarketRow } from "./market";

describe("runCanadianCheck", () => {
  // Pins the figures cited in docs/MODEL_CARD.md; a data or model refresh that moves them must update the card.
  it("reproduces the published Canadian cross-province result", () => {
    const check = runCanadianCheck(marketData as MarketRow[]);
    expect(check.cells).toBe(4609);
    expect(Math.round(check.baselineMae)).toBe(2236);
    expect(Math.round(check.fullEffectMae)).toBe(2961);
    expect(check.fullEffectWins).toBe(2036);
    expect(check.foldScales).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    expect(Math.round(check.crossValidatedMae)).toBe(2142);
    expect(check.scaleByGap.map(({ scale }) => Math.round(scale * 100) / 100)).toEqual([0.37, 0.29, 0.19]);
  });
});
