import { expect, test } from "@playwright/test";
import conditionModel from "../../public/data/condition-model.json";

type SegmentRow = {
  segment: string;
  n: number;
  maeCad?: number;
  wapePct?: number;
  coverage80Pct?: number;
};
type SegmentAxis = { baseline: SegmentRow[]; model: SegmentRow[] };

const segments = conditionModel.validation.segments as unknown as Record<string, SegmentAxis>;
const axes = ["auctionGrade", "saleYear", "priceBand", "logOdometerDeltaSextile", "peerCountTercile"];

test("segment table renders the artifact's baseline-vs-model slices", async ({ page }) => {
  await page.goto("/market-lab");
  const table = page.locator(".segment-table");
  await expect(table).toBeVisible();

  const dataRows = axes.reduce((total, axis) => total + segments[axis].baseline.length, 0);
  await expect(table.locator("tbody tr:has(td)")).toHaveCount(dataRows);

  // Spot-check the thinnest grade (worst WAPE) against the artifact values.
  const salvageBaseline = segments.auctionGrade.baseline.find((row) => row.segment === "Salvage")!;
  const salvageModel = segments.auctionGrade.model.find((row) => row.segment === "Salvage")!;
  const salvageRow = table.locator("tbody tr:has(td)", { hasText: "Salvage" });
  await expect(salvageRow.locator("td").nth(0)).toHaveText(salvageBaseline.n.toLocaleString("en-CA"));
  await expect(salvageRow.locator("td").nth(3)).toHaveText(`${salvageBaseline.wapePct!.toFixed(2)}%`);
  await expect(salvageRow.locator("td").nth(4)).toHaveText(`${salvageModel.wapePct!.toFixed(2)}%`);
  await expect(salvageRow.locator("td").nth(5)).toHaveText(`${salvageModel.coverage80Pct!.toFixed(2)}%`);
});
