import { describe, expect, it } from "vitest";
import { approximatePercentile, confidenceForSample, marketPosition, type MarketRow } from "./market";

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
});
