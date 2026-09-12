import { devices, expect, test } from "@playwright/test";

function intersectArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

const TABLET_WIDTHS = [768, 900];

// Playwright forbids defaultBrowserType inside a describe's test.use (it forces
// a new worker), so strip that one key and keep the rest of the Desktop Chrome
// descriptor. Both configured projects then run geometrically identical.
const { defaultBrowserType, ...desktopChromeUse } = devices["Desktop Chrome"];
void defaultBrowserType;

for (const width of TABLET_WIDTHS) {
  test.describe(`tablet header @ ${width}px`, () => {
    test.use({ ...desktopChromeUse, viewport: { width, height: 1024 } });

    test(`header children stay inside the ${width}px header`, async ({ page }, testInfo) => {
      await page.goto("/");
      // Let the 500ms fade-down header animation settle before measuring/screenshotting.
      await page.waitForTimeout(600);
      await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`) });

      const header = page.locator(".site-header");
      await expect(header).toBeVisible();
      const children = page.locator(".site-header > *");
      await expect(children).toHaveCount(3);

      const headerBox = await header.boundingBox();
      expect(headerBox, "header bounding box").not.toBeNull();

      const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      for (let i = 0; i < 3; i += 1) {
        const box = await children.nth(i).boundingBox();
        expect(box, `child ${i} bounding box`).not.toBeNull();
        boxes.push(box!);
      }

      // 1. Every header child sits inside the header box on all four edges (±1px).
      const edges = ["left", "top", "right", "bottom"] as const;
      boxes.forEach((box, index) => {
        const checks = [
          box.x >= headerBox!.x - 1,
          box.y >= headerBox!.y - 1,
          box.x + box.width <= headerBox!.x + headerBox!.width + 1,
          box.y + box.height <= headerBox!.y + headerBox!.height + 1,
        ];
        const measurements = {
          child: index,
          childBox: box,
          headerBox: headerBox,
          overflowBottom: +(box.y + box.height - (headerBox!.y + headerBox!.height)).toFixed(2),
          overflowRight: +(box.x + box.width - (headerBox!.x + headerBox!.width)).toFixed(2),
        };
        checks.forEach((ok, edgeIndex) => {
          expect(ok, `child ${index} ${edges[edgeIndex]} edge: ${JSON.stringify(measurements)}`).toBe(true);
        });
      });

      // 2. Pair-wise intersection of the three children is zero.
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(intersectArea(boxes[i], boxes[j]), `children ${i} and ${j} overlap`).toBe(0);
        }
      }

      // 3. No horizontal page overflow.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `documentElement.scrollWidth - innerWidth = ${overflow}`).toBeLessThanOrEqual(1);

      // 4. Nav has 4 links, each visible with a box inside the viewport.
      const navLinks = page.locator(".site-header nav a");
      await expect(navLinks).toHaveCount(4);
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      for (let i = 0; i < 4; i += 1) {
        const link = navLinks.nth(i);
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box, `nav link ${i} bounding box`).not.toBeNull();
        expect(box!.x, `nav link ${i} inside viewport (x)`).toBeGreaterThanOrEqual(0);
        expect(box!.y, `nav link ${i} inside viewport (y)`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `nav link ${i} inside viewport (right)`).toBeLessThanOrEqual(viewport!.width);
        expect(box!.y + box!.height, `nav link ${i} inside viewport (bottom)`).toBeLessThanOrEqual(viewport!.height);
      }
    });
  });
}
