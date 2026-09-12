import { describe, expect, it } from "vitest";
import { predictConditionAdjustedValue, type ConditionProfile } from "./condition-model";
import { approximatePercentile, confidenceForSample, dealSignalForMatched, dealSignalForPrediction, deriveComparableBenchmark, displayBandValues, marketPosition, type ComparableObservation, type MarketRow } from "./market";

const row: MarketRow = {
  p: "ON", mk: "Toyota", md: "RAV4", y: 2021, c: "Used", n: 204,
  p10: 25000, p25: 27500, p50: 30000, p75: 32500, p90: 35000,
  mean: 30200, km: 95000, dom: 22,
};

describe("market evidence helpers", () => {
  it("interpolates between published percentiles", () => {
    expect(approximatePercentile(30000, row)).toBe(50);
    expect(approximatePercentile(28750, row)).toBe(38);
  });

  it("describes the asking-price position", () => {
    expect(marketPosition(26000, row)).toBe("below the typical band");
    expect(marketPosition(31000, row)).toBe("inside the typical band");
    expect(marketPosition(34000, row)).toBe("above the typical band");
  });

  it("grades evidence using transparent sample thresholds", () => {
    expect(confidenceForSample(100)).toBe("strong");
    expect(confidenceForSample(40)).toBe("good");
    expect(confidenceForSample(10)).toBe("limited");
  });

  it("derives the reviewed BMW target without using the subject listing", () => {
    const comparables: ComparableObservation[] = [
      { vin: "1", askingPrice: 32488, odometerKm: 70000, location: "ON", transmission: "Automatic", observedAt: "2026-08-25" },
      { vin: "2", askingPrice: 25888, odometerKm: 158557, location: "AB", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "3", askingPrice: 20990, odometerKm: 167000, location: "NS", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "4", askingPrice: 24999, odometerKm: 143962, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "5", askingPrice: 28995, odometerKm: 147537, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "6", askingPrice: 30690, odometerKm: 108893, location: "Canada", transmission: "Automatic", observedAt: "2026-08-31" },
    ];
    const benchmark = deriveComparableBenchmark(comparables, 73677);

    expect(benchmark).toMatchObject({ benchmark: 33200, low: 30700, high: 35600, sampleSize: 6, mileageRatePer10k: -990, rmse: 2400, isExtrapolation: false });
    expect(benchmark!.rSquared).toBeGreaterThan(0.7);
    expect(dealSignalForMatched(34690, benchmark!).label).toBe("Within matched range");
  });

  it("refuses a model when fewer than four valid comparables remain", () => {
    const sparse: ComparableObservation[] = [
      { vin: "1", askingPrice: 30000, odometerKm: 80000, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "2", askingPrice: 0, odometerKm: 90000, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "3", askingPrice: 28000, odometerKm: 100000, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
      { vin: "4", askingPrice: 27000, odometerKm: 110000, location: "ON", transmission: "Automatic", observedAt: "2026-08-31" },
    ];
    expect(deriveComparableBenchmark(sparse, 90000)).toBeUndefined();
  });
});

describe("prediction band scaling", () => {
  const profile: ConditionProfile = {
    conditionGrade: "average",
    accidentHistory: "none",
    mechanicalCondition: "sound",
    cosmeticCondition: "light",
    serviceHistory: "partial",
    wearItems: "good",
  };

  it("scales the typical band from the exact model multiplier on the low-price case", () => {
    const valuation = predictConditionAdjustedValue({
      baseValue: 3150,
      baseLow: 2500,
      baseHigh: 3800,
      baselineOdometerKm: 80000,
      targetOdometerKm: 150000,
      profile,
    });

    expect(valuation.multiplier).toBe(0.7784);
    expect(valuation.multiplierExact).toBeCloseTo(0.778350080061302, 9);
    expect(Math.round(valuation.multiplierExact * 10_000) / 10_000).toBe(valuation.multiplier);
    expect(valuation.estimate).toBe(2500);

    // Premise: the legacy estimate/baseValue ratio is not the model multiplier.
    // On this low-price case it would move the scaled P25 by more than $1.
    const legacyMultiplier = valuation.estimate / valuation.baseValue;
    expect(legacyMultiplier).toBeCloseTo(0.7936508, 6);
    expect(Math.abs(2700 * legacyMultiplier - 2700 * valuation.multiplierExact)).toBeGreaterThan(1);

    const band = displayBandValues({ p25: 2700, p75: 3600 }, valuation);
    expect(band.p25).toBe(2100);
    expect(band.p75).toBe(2800);
    expect(band.p50).toBe(valuation.estimate);
    expect(band.p10).toBe(valuation.low);
    expect(band.p90).toBe(valuation.high);
  });
});

describe("prediction deal signal", () => {
  const averageProfile: ConditionProfile = {
    conditionGrade: "average",
    accidentHistory: "none",
    mechanicalCondition: "sound",
    cosmeticCondition: "light",
    serviceHistory: "partial",
    wearItems: "good",
  };

  it("describes a clamped mileage comparison when the odometer was entered", () => {
    const valuation = predictConditionAdjustedValue({
      baseValue: 30000,
      baseLow: 27000,
      baseHigh: 33000,
      baselineOdometerKm: 95000,
      targetOdometerKm: 400000,
      profile: averageProfile,
    });

    expect(valuation.isOdometerExtrapolation).toBe(true);
    const signal = dealSignalForPrediction(30000, valuation, true);
    expect(signal.label).toBe("Outside trained mileage support");
    expect(signal.detail).toContain("capped");
    expect(signal.detail).not.toContain("no mileage comparison");
  });

  it("describes a level-only out-of-support row when no odometer was entered", () => {
    const valuation = predictConditionAdjustedValue({
      baseValue: 37792,
      baseLow: 35758,
      baseHigh: 41789,
      baselineOdometerKm: 6,
      targetOdometerKm: 6,
      profile: averageProfile,
    });

    expect(valuation.isOdometerExtrapolation).toBe(true);
    const signal = dealSignalForPrediction(31995, valuation, false);
    expect(signal.label).toBe("Outside trained mileage support");
    expect(signal.detail).toContain("no mileage comparison was applied");
    expect(signal.detail).not.toContain("capped");
  });
});
