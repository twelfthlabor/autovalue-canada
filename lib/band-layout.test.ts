import { describe, expect, it } from "vitest";
import marketData from "../public/data/market.json";
import { predictConditionAdjustedValue, type ConditionProfile } from "./condition-model";
import { bandPosition, bandScale, layoutBandItems } from "./band-layout";
import { displayBandValues, type MarketRow } from "./market";

const rows = marketData as unknown as MarketRow[];

const AVERAGE: ConditionProfile = {
  conditionGrade: "average",
  accidentHistory: "none",
  mechanicalCondition: "sound",
  cosmeticCondition: "light",
  serviceHistory: "partial",
  wearItems: "good",
};

function valuationFor(row: MarketRow, targetOdometerKm: number) {
  return predictConditionAdjustedValue({
    baseValue: row.p50,
    baseLow: row.p10,
    baseHigh: row.p90,
    baselineOdometerKm: row.km,
    targetOdometerKm,
    profile: AVERAGE,
  });
}

function positionsFor(values: number[], min: number, max: number) {
  return values.map((value) => Number(bandPosition(value, min, max).toFixed(2)));
}

describe("bandPosition", () => {
  it("maps the RAV4 repro band onto the pinned value scale", () => {
    const row = rows.find((candidate) => candidate.p === "ON" && candidate.mk === "Toyota" && candidate.md === "RAV4" && candidate.y === 2021);
    expect(row).toBeDefined();

    const band = displayBandValues(row!, valuationFor(row!, 89000));
    const scale = bandScale(band);
    // padding = max((p90 - p10) * 0.1, 800); min/max are the model's own scale.
    expect(scale).toEqual({ min: 25070, max: 42230 });
    expect(positionsFor([band.p10, band.p25, band.p50, band.p75, band.p90], scale.min, scale.max)).toEqual([8.33, 17.07, 34.56, 51.46, 91.67]);
    // The repro ask (31,995) lands at 40.36%: a 5.80pp gap from the median.
    expect(Number(bandPosition(31995, scale.min, scale.max).toFixed(2))).toBe(40.36);
  });

  it("maps the low-price Accent cell onto the pinned value scale", () => {
    const row = rows.find((candidate) => candidate.p === "ON" && candidate.mk === "Hyundai" && candidate.md === "Accent" && candidate.y === 2008);
    expect(row).toBeDefined();

    const band = displayBandValues(row!, valuationFor(row!, 150000));
    const scale = bandScale(band);
    expect(positionsFor([band.p10, band.p25, band.p50, band.p75, band.p90], scale.min, scale.max)).toEqual([19.51, 24.39, 34.15, 65.85, 80.49]);
  });

  it("clamps out-of-range values to the 2.5-97.5 presentation band", () => {
    const scale = bandScale({ p10: 26500, p25: 28000, p50: 31000, p75: 33900, p90: 40800 });
    expect(scale).toEqual({ min: 25070, max: 42230 });
    expect(bandPosition(20000, scale.min, scale.max)).toBe(2.5);
    expect(bandPosition(45000, scale.min, scale.max)).toBe(97.5);
    expect(bandPosition(0, scale.min, scale.max)).toBe(2.5);
    expect(bandPosition(1_000_000, scale.min, scale.max)).toBe(97.5);
  });
});

describe("layoutBandItems", () => {
  it("keeps an unclamped item centered with zero shift", () => {
    const layout = layoutBandItems([{ position: 50, width: 40, height: 30 }], 400, 0, 400, 6);
    expect(layout.centers).toEqual([200]);
    expect(layout.shifts).toEqual([0]);
    expect(layout.rows).toEqual([0]);
    expect(layout.rowCount).toBe(1);
    expect(layout.rowHeight).toBe(30);
  });

  it("applies the minimal left-edge clamp when the card inset binds", () => {
    const layout = layoutBandItems([{ position: 10, width: 40, height: 30 }], 400, 30, 390, 6);
    // desired center = 40, minimal allowed center = 30 + 40/2 = 50 -> shift 10.
    expect(layout.centers).toEqual([50]);
    expect(layout.shifts).toEqual([10]);
  });

  it("applies the minimal right-edge clamp when the card inset binds", () => {
    const layout = layoutBandItems([{ position: 95, width: 40, height: 30 }], 400, 30, 390, 6);
    // desired center = 380, maximal allowed center = 390 - 40/2 = 370 -> shift -10.
    expect(layout.centers).toEqual([370]);
    expect(layout.shifts).toEqual([-10]);
  });

  it("wraps colliding RAV4 captions into two rows at a narrow width and one row at the measured width", () => {
    const scale = bandScale({ p10: 26500, p25: 28000, p50: 31000, p75: 33900, p90: 40800 });
    const positions = [8.333, 17.075, 34.557, 51.457, 91.667];
    const items = positions.map((position) => ({ position, width: 40, height: 30 }));

    const narrow = layoutBandItems(items, 354, 0, 354, 6);
    expect(narrow.rowCount).toBe(2);
    expect(narrow.rows[0]).toBe(0);
    expect(narrow.rows[1]).toBe(1);

    const wide = layoutBandItems(items, 746.5, 0, 746.5, 6);
    expect(wide.rowCount).toBe(1);
    expect(wide.rows).toEqual([0, 0, 0, 0, 0]);
    expect(scale.min).toBe(25070);
  });

  it("wraps the Accent P10/P25 captions (4.88pp apart) into separate rows", () => {
    const layout = layoutBandItems(
      [
        { position: 19.512, width: 44, height: 30 },
        { position: 24.39, width: 44, height: 30 },
        { position: 34.146, width: 44, height: 30 },
        { position: 65.854, width: 44, height: 30 },
        { position: 80.488, width: 44, height: 30 },
      ],
      354,
      0,
      354,
      6,
    );
    expect(layout.rows[0]).toBe(0);
    expect(layout.rows[1]).toBe(1);
    expect(layout.rowCount).toBe(2);
  });

  it("gives equal positions separate rows", () => {
    const layout = layoutBandItems(
      [
        { position: 50, width: 40, height: 30 },
        { position: 50, width: 40, height: 30 },
      ],
      400,
      0,
      400,
      6,
    );
    expect(layout.rows).toEqual([0, 1]);
    expect(layout.rowCount).toBe(2);
  });

  it("feeds clamped centers into row assignment", () => {
    const items = [
      { position: 2, width: 40, height: 20 },
      { position: 14, width: 40, height: 20 },
    ];
    // With a permissive card edge the first item keeps its desired center
    // (8px, right edge 28px) and the second box clears it: one row.
    const unclamped = layoutBandItems(items, 400, -20, 420, 6);
    expect(unclamped.centers).toEqual([8, 56]);
    expect(unclamped.rows).toEqual([0, 0]);
    // Once the card inset clamps the first center to 50px (right edge 70px),
    // the boxes collide and the second caption must wrap.
    const clamped = layoutBandItems(items, 400, 30, 390, 6);
    expect(clamped.centers).toEqual([50, 56]);
    expect(clamped.rows).toEqual([0, 1]);
    expect(clamped.rowCount).toBe(2);
  });

  it("reports the tallest item as the row height used by the container", () => {
    const layout = layoutBandItems(
      [
        { position: 10, width: 40, height: 28 },
        { position: 90, width: 40, height: 34 },
      ],
      400,
      0,
      400,
      6,
    );
    expect(layout.rowHeight).toBe(34);
  });
});
