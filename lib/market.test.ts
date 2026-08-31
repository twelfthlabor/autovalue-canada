import { describe, expect, it } from "vitest";
import { approximatePercentile, confidenceForSample, dealSignalForMatched, deriveComparableBenchmark, marketPosition, type ComparableObservation, type MarketRow } from "./market";

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
