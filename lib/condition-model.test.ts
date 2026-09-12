import { describe, expect, it } from "vitest";
import { conditionScore, predictConditionAdjustedValue, type ConditionProfile } from "./condition-model";

const averageProfile: ConditionProfile = {
  conditionGrade: "average",
  accidentHistory: "none",
  mechanicalCondition: "sound",
  cosmeticCondition: "light",
  serviceHistory: "partial",
  wearItems: "good",
};

describe("transaction-trained condition model", () => {
  it("maps the default inspection profile to the learned Average grade", () => {
    expect(conditionScore(averageProfile)).toBe(2);
  });

  it("centres an Average vehicle on the current market anchor", () => {
    const result = predictConditionAdjustedValue({
      baseValue: 30_000,
      baseLow: 25_000,
      baseHigh: 35_000,
      baselineOdometerKm: 80_000,
      targetOdometerKm: 80_000,
      profile: averageProfile,
    });
    expect(result.multiplier).toBe(1);
    expect(result.estimate).toBe(30_000);
    expect(result.low).toBeLessThan(result.estimate);
    expect(result.high).toBeGreaterThan(result.estimate);
  });

  it("lowers the value for rough condition and higher mileage", () => {
    const rough = predictConditionAdjustedValue({
      baseValue: 30_000,
      baseLow: 25_000,
      baseHigh: 35_000,
      baselineOdometerKm: 80_000,
      targetOdometerKm: 150_000,
      profile: { ...averageProfile, conditionGrade: "rough", accidentHistory: "major", mechanicalCondition: "major-repair" },
    });
    const average = predictConditionAdjustedValue({
      baseValue: 30_000,
      baseLow: 25_000,
      baseHigh: 35_000,
      baselineOdometerKm: 80_000,
      targetOdometerKm: 80_000,
      profile: averageProfile,
    });
    expect(rough.conditionScore).toBe(-0.75);
    expect(rough.estimate).toBeLessThan(average.estimate);
  });

  it("never gives above-Average grades less than Average at equal mileage", () => {
    const clean = predictConditionAdjustedValue({
      baseValue: 30_000,
      baseLow: 25_000,
      baseHigh: 35_000,
      baselineOdometerKm: 80_000,
      targetOdometerKm: 80_000,
      profile: { ...averageProfile, conditionGrade: "extra-clean" },
    });
    const average = predictConditionAdjustedValue({
      baseValue: 30_000,
      baseLow: 25_000,
      baseHigh: 35_000,
      baselineOdometerKm: 80_000,
      targetOdometerKm: 80_000,
      profile: averageProfile,
    });
    expect(clean.estimate).toBeGreaterThanOrEqual(average.estimate);
  });
});

describe("odometer extrapolation flag", () => {
  // Odometer support is 100–350,000 km (inclusive) and the log-delta quantile
  // bound is 0.880628. A comparison is "outside support" when either raw
  // odometer crosses a bound, or when clamping moved the raw mileage delta away
  // from the model's clamped delta. The returned logOdometerDelta is the model
  // feature (from clamped odometers), not the raw delta.
  const vectors: Array<{ baseline: number; target: number; flag: boolean; logOdometerDelta: number }> = [
    { baseline: 300_000, target: 400_000, flag: true, logOdometerDelta: 0.1542 },
    { baseline: 200_000, target: 500_000, flag: true, logOdometerDelta: 0.5596 },
    { baseline: 50, target: 100, flag: true, logOdometerDelta: 0 },
    { baseline: 6, target: 6, flag: true, logOdometerDelta: 0 },
    { baseline: 80_000, target: 80_000, flag: false, logOdometerDelta: 0 },
    { baseline: 100, target: 100, flag: false, logOdometerDelta: 0 },
    { baseline: 350_000, target: 350_000, flag: false, logOdometerDelta: 0 },
    { baseline: 300_000, target: 350_000, flag: false, logOdometerDelta: 0.1542 },
    { baseline: 300_000, target: 350_001, flag: true, logOdometerDelta: 0.1542 },
    { baseline: 100, target: 350_000, flag: true, logOdometerDelta: 0.8806 },
    { baseline: 90, target: 90, flag: true, logOdometerDelta: 0 },
    { baseline: -5, target: -6, flag: true, logOdometerDelta: 0 },
    { baseline: -100, target: 50_000, flag: true, logOdometerDelta: 0.8806 },
    { baseline: 100_000, target: 80_000, flag: false, logOdometerDelta: -0.2231 },
    { baseline: 300_000, target: 100_000, flag: false, logOdometerDelta: -1.0986 },
    { baseline: 350_000, target: 100, flag: true, logOdometerDelta: -1.1618 },
  ];

  for (const { baseline, target, flag, logOdometerDelta } of vectors) {
    it(`baseline ${baseline} km → target ${target} km flags ${flag} with logOdometerDelta ${logOdometerDelta}`, () => {
      const result = predictConditionAdjustedValue({
        baseValue: 30_000,
        baseLow: 25_000,
        baseHigh: 35_000,
        baselineOdometerKm: baseline,
        targetOdometerKm: target,
        profile: averageProfile,
      });
      expect(result.isOdometerExtrapolation).toBe(flag);
      expect(result.logOdometerDelta).toBe(logOdometerDelta);
    });
  }
});
