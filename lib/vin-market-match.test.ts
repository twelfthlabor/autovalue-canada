import { describe, expect, it } from "vitest";
import marketData from "../public/data/market.json";
import type { MarketRow } from "./market";
import { resolveVinMarketSelection, vinMarketEditAction, type VinMarketSelection } from "./vin-market-match";

function row(overrides: Partial<MarketRow> & Pick<MarketRow, "p" | "mk" | "md" | "y" | "n">): MarketRow {
  return {
    c: "Used",
    p10: 9000,
    p25: 11000,
    p50: 13000,
    p75: 15000,
    p90: 17000,
    mean: 13000,
    km: 100000,
    dom: 30,
    ...overrides,
  };
}

const current: VinMarketSelection = { province: "ON", make: "Toyota", model: "RAV4", year: "2021" };

describe("resolveVinMarketSelection", () => {
  it("prefers the exact spelling over a normalized alias that sorts first", () => {
    const rows = [
      row({ p: "ON", mk: "Toyota", md: "RAV 4", y: 2024, n: 14 }),
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2020, n: 110 }),
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2024, n: 304 }),
      row({ p: "ON", mk: "Toyota", md: "RAV", y: 2021, n: 15 }),
    ];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV4", year: 2020 },
    });

    expect(result.selection).toEqual({ province: "ON", make: "Toyota", model: "RAV4", year: "2020" });
    expect(result.cellMatched).toBe(true);
  });

  it("breaks a normalized-spelling tie toward the candidate that carries the decoded year", () => {
    const rows = [
      row({ p: "ON", mk: "Toyota", md: "RAV 4", y: 2024, n: 90 }),
      row({ p: "ON", mk: "Toyota", md: "RAV-4", y: 2020, n: 12 }),
    ];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV4", year: 2020 },
    });

    expect(result.selection.model).toBe("RAV-4");
    expect(result.selection.year).toBe("2020");
    expect(result.cellMatched).toBe(true);
  });

  it("falls back to a year the model actually publishes when the decoded year is absent", () => {
    const rows = [
      row({ p: "ON", mk: "Toyota", md: "RAV 4", y: 2024, n: 14 }),
      row({ p: "ON", mk: "Toyota", md: "RAV 4", y: 2023, n: 11 }),
    ];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV 4", year: 2020 },
    });

    const publishedYears = [...new Set(rows.filter((candidate) => candidate.md === result.selection.model).map((candidate) => String(candidate.y)))];
    expect(publishedYears).toContain(result.selection.year);
    expect(result.selection.year).toBe("2024");
    expect(result.cellMatched).toBe(false);
  });

  it("keeps the exact spelling even when a normalized alias carries the decoded year", () => {
    const rows = [
      row({ p: "ON", mk: "Toyota", md: "RAV 4", y: 2020, n: 40 }),
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2024, n: 5 }),
    ];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV4", year: 2020 },
    });

    expect(result.selection.model).toBe("RAV4");
    expect(result.selection.year).toBe("2024");
    expect(result.cellMatched).toBe(false);
  });

  it("returns the current selection when the decoded make is absent from the province", () => {
    const rows = [row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2020, n: 110 })];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Ferrari", model: "Roma", year: 2020 },
    });

    expect(result.selection).toEqual(current);
    expect(result.cellMatched).toBe(false);
  });

  it("does not swap the make alone when no model candidate matches", () => {
    const rows = [
      row({ p: "ON", mk: "Honda", md: "Civic", y: 2020, n: 50 }),
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2020, n: 110 }),
    ];
    const hondaCurrent: VinMarketSelection = { province: "ON", make: "Honda", model: "Civic", year: "2020" };

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current: hondaCurrent,
      decoded: { make: "Toyota", model: "Supra", year: 2020 },
    });

    expect(result.selection).toEqual(hondaCurrent);
    expect(result.cellMatched).toBe(false);
  });

  it("matches the make case-insensitively after the exact pass", () => {
    const rows = [row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2020, n: 110 })];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "TOYOTA", model: "RAV4", year: 2020 },
    });

    expect(result.selection.make).toBe("Toyota");
    expect(result.cellMatched).toBe(true);
  });

  it("treats a non-finite decoded year as unsupported and still returns valid options", () => {
    const rows = [
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2020, n: 110 }),
      row({ p: "ON", mk: "Toyota", md: "RAV4", y: 2021, n: 204 }),
    ];

    const result = resolveVinMarketSelection({
      rows,
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV4", year: Number.NaN },
    });

    expect(result.selection).toEqual({ province: "ON", make: "Toyota", model: "RAV4", year: "2021" });
    expect(result.cellMatched).toBe(false);
  });

  it("resolves the live RAV4 VIN against the committed market release", () => {
    const result = resolveVinMarketSelection({
      rows: marketData as unknown as MarketRow[],
      province: "ON",
      current,
      decoded: { make: "Toyota", model: "RAV4", year: 2020 },
    });

    expect(result.selection).toEqual({ province: "ON", make: "Toyota", model: "RAV4", year: "2020" });
    expect(result.cellMatched).toBe(true);
  });
});

describe("vinMarketEditAction", () => {
  it("preserves the decode for edits that are not vehicle identity or VIN", () => {
    const unrelatedFields = ["askingPrice", "odometer", "conditionGrade", "accidentHistory", "mechanicalCondition", "cosmeticCondition", "serviceHistory", "wearItems"];
    for (const field of unrelatedFields) {
      expect(vinMarketEditAction(field)).toEqual({ clearsBlock: false, clearsReport: false });
    }
  });

  it("abandons the decode for vehicle identity and VIN edits", () => {
    for (const field of ["province", "make", "model", "year", "vin"]) {
      expect(vinMarketEditAction(field)).toEqual({ clearsBlock: true, clearsReport: true });
    }
  });

  it("keeps the decoded VIN blocked across a price edit until the year changes", () => {
    const rows = marketData as unknown as MarketRow[];
    const { selection, cellMatched } = resolveVinMarketSelection({
      rows,
      province: "AB",
      current: { province: "AB", make: "Buick", model: "Encore GX", year: "2026" },
      decoded: { make: "Audi", model: "Q3", year: 2020 },
    });

    expect(cellMatched).toBe(false);
    expect(selection).toEqual({ province: "AB", make: "Audi", model: "Q3", year: "2025" });

    const state = { blocked: !cellMatched, reportActive: true };
    const apply = (field: string) => {
      const action = vinMarketEditAction(field);
      if (action.clearsBlock) state.blocked = false;
      if (action.clearsReport) state.reportActive = false;
    };

    apply("askingPrice");
    expect(state).toEqual({ blocked: true, reportActive: true });

    apply("year");
    expect(state).toEqual({ blocked: false, reportActive: false });
  });
});
