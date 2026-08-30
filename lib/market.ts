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
