import { describe, expect, it } from "vitest";
import marketData from "../public/data/market.json";
import { predictConditionAdjustedValue, type ConditionProfile } from "./condition-model";
import { displayBandValues, type MarketRow } from "./market";

const rows = marketData as unknown as MarketRow[];

const AVERAGE: ConditionProfile = {
  conditionGrade: "average",
};

const WORST: ConditionProfile = {
  conditionGrade: "salvage",
};

const BEST: ConditionProfile = {
  conditionGrade: "extra-clean",
};

function valuationFor(row: MarketRow, profile: ConditionProfile, targetOdometerKm: number) {
  return predictConditionAdjustedValue({
    baseValue: row.p50,
    baseLow: row.p10,
    baseHigh: row.p90,
    baselineOdometerKm: row.km,
    targetOdometerKm,
    profile,
  });
}

describe("displayed prediction band ordering", () => {
  it("keeps the Corolla Cross zero-ask cell's P25 at or below its ML median", () => {
    const row = rows.find((candidate) => candidate.p === "AB" && candidate.mk === "Toyota" && candidate.md === "Corolla Cross" && candidate.y === 2026);
    expect(row).toBeDefined();

    const valuation = valuationFor(row!, WORST, 100000);
    const band = displayBandValues(row!, valuation);

    expect(Math.round(band.p25)).toBe(21100);
    expect(band.p25).toBeLessThanOrEqual(band.p50);
    expect(band.p50).toBeLessThanOrEqual(band.p75);
  });

  it("keeps all 50,445 row x profile x target combinations monotone", () => {
    const profiles: Array<[string, ConditionProfile]> = [
      ["average", AVERAGE],
      ["worst", WORST],
      ["best", BEST],
    ];
    const violations: string[] = [];

    for (const row of rows) {
      for (const [profileName, profile] of profiles) {
        for (const target of [row.km, 100000, 200000]) {
          const band = displayBandValues(row, valuationFor(row, profile, target));
          if (!(band.p10 <= band.p25 && band.p25 <= band.p50 && band.p50 <= band.p75 && band.p75 <= band.p90)) {
            violations.push(`${row.p}/${row.mk}/${row.md}/${row.y} ${profileName} ${target}: p10=${band.p10} p25=${band.p25} p50=${band.p50} p75=${band.p75} p90=${band.p90}`);
          }
        }
      }
    }

    expect(violations.length, `${violations.length} violations; e.g. ${violations.slice(0, 5).join(" | ")}`).toBe(0);
  });
});
