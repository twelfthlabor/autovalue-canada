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
