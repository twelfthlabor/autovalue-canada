export type MarketRow = {
  p: string;
  mk: string;
  md: string;
  y: number;
  c: string;
  n: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  km: number;
  dom: number;
};

export type Confidence = "strong" | "good" | "limited";

export type ComparableObservation = {
  vin: string;
  askingPrice: number;
  odometerKm: number;
  location: string;
  transmission: string;
  observedAt: string;
};

export type ComparableBenchmark = {
  benchmark: number;
  low: number;
  high: number;
  sampleSize: number;
  mileageRatePer10k: number;
  rmse: number;
  rSquared: number;
  odometerMin: number;
  odometerMax: number;
  isExtrapolation: boolean;
};

export type DealSignal = {
  label: string;
  detail: string;
  tone: "watch" | "typical" | "high";
};

export function confidenceForSample(sampleSize: number): Confidence {
  if (sampleSize >= 100) return "strong";
  if (sampleSize >= 40) return "good";
  return "limited";
}

export function approximatePercentile(askingPrice: number, row: MarketRow): number {
  const points = [
    [row.p10, 10],
    [row.p25, 25],
    [row.p50, 50],
    [row.p75, 75],
    [row.p90, 90],
  ] as const;

  if (askingPrice <= row.p10) return Math.max(1, Math.round((askingPrice / row.p10) * 10));
  if (askingPrice >= row.p90) return Math.min(99, Math.round(90 + ((askingPrice - row.p90) / row.p90) * 50));

  for (let index = 1; index < points.length; index += 1) {
    const [upperPrice, upperPercentile] = points[index];
    const [lowerPrice, lowerPercentile] = points[index - 1];
    if (askingPrice <= upperPrice) {
      const share = (askingPrice - lowerPrice) / (upperPrice - lowerPrice || 1);
      return Math.round(lowerPercentile + share * (upperPercentile - lowerPercentile));
    }
  }
  return 50;
}

export function marketPosition(askingPrice: number, row: MarketRow) {
  if (askingPrice < row.p25) return "below the typical band";
  if (askingPrice > row.p75) return "above the typical band";
  return "inside the typical band";
}

function nearestHundred(value: number) {
  return Math.round(value / 100) * 100;
}

/**
 * Fits a transparent one-feature ordinary least-squares line to matched
 * asking-price comparables. The subject listing must not be included.
 */
export function deriveComparableBenchmark(comparables: ComparableObservation[], targetOdometerKm: number): ComparableBenchmark | undefined {
  const validComparables = comparables.filter((item) => Number.isFinite(item.odometerKm) && item.odometerKm > 0 && Number.isFinite(item.askingPrice) && item.askingPrice > 0);
  if (validComparables.length < 4 || !Number.isFinite(targetOdometerKm) || targetOdometerKm <= 0) return undefined;

  const meanKm = validComparables.reduce((sum, item) => sum + item.odometerKm, 0) / validComparables.length;
  const meanPrice = validComparables.reduce((sum, item) => sum + item.askingPrice, 0) / validComparables.length;
  const denominator = validComparables.reduce((sum, item) => sum + (item.odometerKm - meanKm) ** 2, 0);
  if (!denominator) return undefined;

  const slope = validComparables.reduce(
    (sum, item) => sum + (item.odometerKm - meanKm) * (item.askingPrice - meanPrice),
    0,
  ) / denominator;
  const intercept = meanPrice - slope * meanKm;
  const rawBenchmark = intercept + slope * targetOdometerKm;
  const squaredError = validComparables.reduce((sum, item) => {
    const residual = item.askingPrice - (intercept + slope * item.odometerKm);
    return sum + residual ** 2;
  }, 0);
  const rawRmse = Math.sqrt(squaredError / Math.max(1, validComparables.length - 2));
  const totalSquaredError = validComparables.reduce((sum, item) => sum + (item.askingPrice - meanPrice) ** 2, 0);
  const odometerValues = validComparables.map((item) => item.odometerKm);
  const odometerMin = Math.min(...odometerValues);
  const odometerMax = Math.max(...odometerValues);

  return {
    benchmark: nearestHundred(rawBenchmark),
    low: nearestHundred(rawBenchmark - rawRmse),
    high: nearestHundred(rawBenchmark + rawRmse),
    sampleSize: validComparables.length,
    mileageRatePer10k: Math.round((slope * 10000) / 10) * 10,
    rmse: nearestHundred(rawRmse),
    rSquared: totalSquaredError ? Math.round(Math.max(0, 1 - squaredError / totalSquaredError) * 100) / 100 : 0,
    odometerMin,
    odometerMax,
    isExtrapolation: targetOdometerKm < odometerMin || targetOdometerKm > odometerMax,
  };
}

export function dealSignalForMatched(askingPrice: number, benchmark: ComparableBenchmark): DealSignal {
  if (benchmark.isExtrapolation) {
    return {
      label: "Outside mileage support",
      detail: "The odometer is beyond the matched sample, so the fitted price is not a reliable deal signal.",
      tone: "high",
    };
  }
  if (askingPrice < benchmark.low) {
    return {
      label: "Below matched range",
      detail: "Potentially favourable, but a low ask is a reason to verify history, condition and fees.",
      tone: "watch",
    };
  }
  if (askingPrice > benchmark.high) {
    return {
      label: "Above matched range",
      detail: "The seller is asking more than the mileage-adjusted matched-comparable range.",
      tone: "high",
    };
  }
  return {
    label: "Within matched range",
    detail: "The ask is consistent with the limited set of matched public listings after mileage adjustment.",
    tone: "typical",
  };
}

export function dealSignalForMarket(askingPrice: number, row: MarketRow): DealSignal {
  if (askingPrice < row.p25) return { label: "Below broad-market range", detail: "Potentially favourable, but trim and condition are not controlled here.", tone: "watch" };
  if (askingPrice > row.p75) return { label: "Above broad-market range", detail: "The ask is above the middle 50% for this model family; trim may explain the gap.", tone: "high" };
  return { label: "Inside broad-market range", detail: "The ask sits inside the model-family middle 50%; this is not yet a trim-level verdict.", tone: "typical" };
}

export function formatCad(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRetrievedDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${MONTHS_SHORT[month - 1]} ${day}, ${year}`;
}
