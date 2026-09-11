import type { MarketRow } from "./market";

export type VinMarketSelection = { province: string; make: string; model: string; year: string };

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolves the VIN-decoded vehicle onto the market selector state.
 *
 * Commit A extraction: this is the workbench's previous inline behavior moved
 * verbatim behind the final API, so the component change stays behavior-neutral.
 */
export function resolveVinMarketSelection(input: {
  rows: MarketRow[];
  province: string;
  current: VinMarketSelection;
  decoded: { make: string; model: string; year: number };
}): { selection: VinMarketSelection; cellMatched: boolean } {
  const { rows, province, current, decoded } = input;
  const make = uniqueSorted(rows.filter((row) => row.p === province).map((row) => row.mk))
    .find((candidate) => candidate.toLowerCase() === decoded.make.toLowerCase());
  const decodedMarketModel = decoded.model;
  const model = make
    ? uniqueSorted(rows.filter((row) => row.p === province && row.mk === make).map((row) => row.md))
        .find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === decodedMarketModel.toLowerCase().replace(/[^a-z0-9]/g, ""))
    : undefined;
  const cellMatched = Boolean(make && model && rows.some((row) => row.p === province && row.mk === make && row.md === model && row.y === decoded.year));

  return {
    selection: {
      province,
      make: make ?? current.make,
      model: model ?? current.model,
      year: make && model ? String(decoded.year) : current.year,
    },
    cellMatched,
  };
}
