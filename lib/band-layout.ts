/**
 * Pure geometry for the valuation distribution band.
 *
 * `position(value)` percent is the only source of truth: dots, labels and
 * captions all project through `bandPosition`, and the only permitted
 * displacement is the minimal measured containment shift returned by
 * `layoutBandItems` (rendered as `--band-shift`). No hand-tuned pixel offsets.
 */

export type BandValues = {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
};

export type BandScale = { min: number; max: number };

/** The displayed model's own scale: 10% padding on either side, at least $800. */
export function bandScale(band: BandValues): BandScale {
  const padding = Math.max((band.p90 - band.p10) * 0.1, 800);
  return {
    min: Math.max(0, Math.min(band.p10, band.p25) - padding),
    max: Math.max(band.p90, band.p75) + padding,
  };
}

/** Percent position inside `.price-band`, clamped to the 2.5-97.5 presentation band. */
export function bandPosition(value: number, min: number, max: number): number {
  return Math.max(2.5, Math.min(97.5, ((value - min) / (max - min)) * 100));
}

export type BandLayoutItem = {
  /** Value-scale percent from `bandPosition`. */
  position: number;
  /** Measured rendered width in px. */
  width: number;
  /** Measured rendered height in px. */
  height: number;
};

export type BandLayout = {
  /** Clamped center of each item, in the same coordinate space as minCenterPx/maxCenterPx. */
  centers: number[];
  /** Minimal clamp shift per item: centers[i] - desiredCenter[i]. */
  shifts: number[];
  /** Greedy wrapped row index per item, in value order. */
  rows: number[];
  /** Number of rows occupied. */
  rowCount: number;
  /** Tallest item height, used as the container row height. */
  rowHeight: number;
};

/**
 * Lay out measured band items on the percent scale.
 *
 * `bandWidth` maps positions to px; `minCenterPx`/`maxCenterPx` are the card's
 * inner edges in the same coordinate space as the returned centers. Each item
 * is clamped minimally to `[minCenterPx + width / 2, maxCenterPx - width / 2]`,
 * then assigned to the first row (value order, `gapPx` between boxes) where it
 * does not collide with the previous item in that row.
 */
export function layoutBandItems(
  items: BandLayoutItem[],
  bandWidth: number,
  minCenterPx: number,
  maxCenterPx: number,
  gapPx: number,
): BandLayout {
  const centers: number[] = [];
  const shifts: number[] = [];
  const rows: number[] = [];
  const rowRightEdges: number[] = [];
  let rowHeight = 0;

  for (const item of items) {
    const desired = (bandWidth * item.position) / 100;
    const lower = minCenterPx + item.width / 2;
    const upper = maxCenterPx - item.width / 2;
    const center = Math.min(Math.max(desired, lower), upper);
    centers.push(center);
    shifts.push(center - desired);
    rowHeight = Math.max(rowHeight, item.height);

    const left = center - item.width / 2;
    let row = 0;
    while (row < rowRightEdges.length && left < rowRightEdges[row] + gapPx) row += 1;
    if (row === rowRightEdges.length) rowRightEdges.push(Number.NEGATIVE_INFINITY);
    rowRightEdges[row] = center + item.width / 2;
    rows.push(row);
  }

  return { centers, shifts, rows, rowCount: rowRightEdges.length, rowHeight };
}
