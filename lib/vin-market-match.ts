import type { MarketRow } from "./market";

export type VinMarketSelection = { province: string; make: string; model: string; year: string };

function normalizeSpelling(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * 0 = exact string, 1 = case-insensitive equal, 2 = equal after stripping
 * non-alphanumerics (e.g. "RAV 4" / "RAV4", "F-150" / "F150").
 * Anything else is not a defensible model-spelling match.
 */
function spellingRank(candidate: string, decodedModel: string): number | undefined {
  if (candidate === decodedModel) return 0;
  if (candidate.toLowerCase() === decodedModel.toLowerCase()) return 1;
  if (normalizeSpelling(candidate) === normalizeSpelling(decodedModel)) return 2;
  return undefined;
}

type ModelCandidate = {
  model: string;
  rank: number;
  hasDecodedYear: boolean;
  decodedYearCount: number;
  totalCount: number;
};

function compareCandidates(a: ModelCandidate, b: ModelCandidate) {
  if (a.hasDecodedYear !== b.hasDecodedYear) return a.hasDecodedYear ? -1 : 1;
  if (a.decodedYearCount !== b.decodedYearCount) return b.decodedYearCount - a.decodedYearCount;
  if (a.totalCount !== b.totalCount) return b.totalCount - a.totalCount;
  return a.model.localeCompare(b.model);
}

/**
 * Resolves the VIN-decoded vehicle onto the market selector state.
 *
 * Exact spelling outranks year support, but within a spelling rank candidates
 * carrying the decoded year win; the returned selection always references
 * values that exist in the corresponding select options. When nothing matches,
 * the current selection is returned untouched (never a partial make swap).
 */
export function resolveVinMarketSelection(input: {
  rows: MarketRow[];
  province: string;
  current: VinMarketSelection;
  decoded: { make: string; model: string; year: number };
}): { selection: VinMarketSelection; cellMatched: boolean } {
  const { rows, province, current, decoded } = input;
  const provinceMakes = [...new Set(rows.filter((row) => row.p === province).map((row) => row.mk))];
  const make = provinceMakes.find((candidate) => candidate === decoded.make)
    ?? provinceMakes.find((candidate) => candidate.toLowerCase() === decoded.make.toLowerCase());
  if (!make) return { selection: current, cellMatched: false };

  const yearSupported = Number.isFinite(decoded.year) && Number.isInteger(decoded.year);
  const models = [...new Set(rows.filter((row) => row.p === province && row.mk === make).map((row) => row.md))];
  let best: ModelCandidate | undefined;
  for (const model of models) {
    const rank = spellingRank(model, decoded.model);
    if (rank === undefined || rank > 2) continue;
    const modelRows = rows.filter((row) => row.p === province && row.mk === make && row.md === model);
    const decodedYearRows = yearSupported ? modelRows.filter((row) => row.y === decoded.year) : [];
    const candidate: ModelCandidate = {
      model,
      rank,
      hasDecodedYear: decodedYearRows.length > 0,
      decodedYearCount: decodedYearRows.reduce((sum, row) => sum + row.n, 0),
      totalCount: modelRows.reduce((sum, row) => sum + row.n, 0),
    };
    if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && compareCandidates(candidate, best) < 0)) best = candidate;
  }
  if (!best) return { selection: current, cellMatched: false };

  const chosenRows = rows.filter((row) => row.p === province && row.mk === make && row.md === best.model);
  const cellMatched = yearSupported && chosenRows.some((row) => row.y === decoded.year);
  const latestYear = chosenRows.reduce((latest, row) => Math.max(latest, row.y), chosenRows[0].y);

  return {
    selection: {
      province,
      make,
      model: best.model,
      year: cellMatched ? String(decoded.year) : String(latestYear),
    },
    cellMatched,
  };
}
