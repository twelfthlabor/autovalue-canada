import { predictConditionAdjustedValue } from "./condition-model";
import type { MarketRow } from "./market";

export type CanadianCheck = {
  cells: number;
  baselineMae: number;
  fullEffectMae: number;
  fullEffectWins: number;
  foldScales: number[];
  crossValidatedMae: number;
  scaleByGap: { gap: [number, number]; pairs: number; scale: number }[];
};

const SCALE_GRID = Array.from({ length: 21 }, (_, index) => index / 20);
const GAP_BUCKETS: [number, number][] = [[0, 0.15], [0.15, 0.4], [0.4, Infinity]];

function logMileageMultiplier(donor: MarketRow, targetOdometerKm: number) {
  return Math.log(predictConditionAdjustedValue({
    baseValue: donor.p50,
    baseLow: donor.p10,
    baseHigh: donor.p90,
    baselineOdometerKm: donor.km,
    targetOdometerKm,
    profile: { conditionGrade: "average" },
  }).multiplierExact);
}

/**
 * Leave-one-province-out check of the auction-trained mileage effect on
 * Canadian data: predict each used cell's median from the same make, model and
 * year in other provinces, scaling the model's log mileage multiplier by k.
 * Cell medians, not individual cars, so this tests the effect at median level.
 */
export function runCanadianCheck(rows: MarketRow[]): CanadianCheck {
  const groups = new Map<string, MarketRow[]>();
  for (const row of rows) {
    if (row.c !== "Used" || row.km <= 0) continue;
    const key = `${row.mk}|${row.md}|${row.y}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const multiGroups = [...groups.values()].filter((group) => group.length > 1);

  const cases = multiGroups.flatMap((group, groupIndex) => group.map((target) => ({
    actual: target.p50,
    fold: groupIndex % 5,
    donors: group.filter((donor) => donor !== target).map((donor) => ({ weight: donor.n, price: donor.p50, logMultiplier: logMileageMultiplier(donor, target.km) })),
  })));
  type Case = (typeof cases)[number];
  const predict = (item: Case, scale: number) => item.donors.reduce((sum, donor) => sum + donor.weight * donor.price * Math.exp(scale * donor.logMultiplier), 0)
    / item.donors.reduce((sum, donor) => sum + donor.weight, 0);
  const absoluteError = (item: Case, scale: number) => Math.abs(predict(item, scale) - item.actual);
  const mae = (items: Case[], scale: number) => items.reduce((sum, item) => sum + absoluteError(item, scale), 0) / items.length;

  // Fold by make-model-year group so a group never informs its own scale.
  const foldScales: number[] = [];
  let crossValidatedError = 0;
  for (let fold = 0; fold < 5; fold++) {
    const train = cases.filter((item) => item.fold !== fold);
    const best = SCALE_GRID.reduce((a, b) => (mae(train, b) < mae(train, a) ? b : a));
    foldScales.push(best);
    crossValidatedError += cases.filter((item) => item.fold === fold).reduce((sum, item) => sum + absoluteError(item, best), 0);
  }

  // Least-squares slope of the observed log price ratio on the model's log
  // multiplier, after removing each province's average log price level. If
  // noisy mileage medians were the only reason for a small k, it would rise
  // toward 1 as the mileage gap grows.
  const provinceOffsets = new Map<string, number[]>();
  for (const group of multiGroups) {
    const meanLog = group.reduce((sum, row) => sum + Math.log(row.p50), 0) / group.length;
    for (const row of group) provinceOffsets.set(row.p, [...(provinceOffsets.get(row.p) ?? []), Math.log(row.p50) - meanLog]);
  }
  const offset = new Map([...provinceOffsets].map(([province, values]) => [province, values.reduce((a, b) => a + b, 0) / values.length]));
  const sums = GAP_BUCKETS.map(() => ({ xy: 0, xx: 0, pairs: 0 }));
  for (const group of multiGroups) {
    for (const target of group) {
      for (const donor of group) {
        if (donor === target) continue;
        const gap = Math.abs(Math.log1p(target.km) - Math.log1p(donor.km));
        const bucket = sums[GAP_BUCKETS.findIndex(([low, high]) => gap >= low && gap < high)];
        const x = logMileageMultiplier(donor, target.km);
        const y = Math.log(target.p50 / donor.p50) - (offset.get(target.p)! - offset.get(donor.p)!);
        bucket.xy += x * y;
        bucket.xx += x * x;
        bucket.pairs++;
      }
    }
  }

  return {
    cells: cases.length,
    baselineMae: mae(cases, 0),
    fullEffectMae: mae(cases, 1),
    fullEffectWins: cases.filter((item) => absoluteError(item, 1) < absoluteError(item, 0)).length,
    foldScales,
    crossValidatedMae: crossValidatedError / cases.length,
    scaleByGap: GAP_BUCKETS.map((gap, index) => ({ gap, pairs: sums[index].pairs, scale: sums[index].xy / sums[index].xx })),
  };
}
