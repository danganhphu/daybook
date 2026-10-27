import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";

import { Then } from "./fixtures";

// The narrowest width WCAG 1.4.10 asks to reflow at, and text at twice its size (1.4.4), as a phone set to large text
const reflowWidth = 320;
const largeText = "200%";

// WCAG 2.2 A and AA, the level docs/ui/design-system.md holds the design system to
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

Then("trang không có lỗi trợ năng", async ({ page }) => {
  // Axe measures colour as painted, so let fades finish; allSettled because a cancelled animation rejects
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();

  // Rule ids and the elements they hit read better in a failure than the full axe report
  const violations = results.violations.map((violation) => ({
    rule: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(violations).toEqual([]);
});

// Whatever scrolls the page (the document, or the box the page sits in) must not be wider than the screen; a chip row
// scrolling inside itself is fine
Then(
  "các màn {string} không phải kéo ngang khi màn hẹp và chữ to",
  async ({ page }, paths: string) => {
    await page.setViewportSize({ width: reflowWidth, height: 720 });
    const wide: string[] = [];
    for (const path of paths.split(", ")) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const found = await page.evaluate(async (size) => {
        document.documentElement.style.fontSize = size;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const main = document.querySelector("main");
        const scrollers: Element[] = [document.documentElement];
        for (let each = main; each !== null; each = each.parentElement) {
          if (["auto", "scroll"].includes(getComputedStyle(each).overflowX)) {
            scrollers.push(each);
          }
        }

        return scrollers
          .filter((each) => each.scrollWidth > each.clientWidth + 1)
          .map(
            (each) =>
              `${each.tagName.toLowerCase()} ${each.scrollWidth}px in ${each.clientWidth}px`,
          );
      }, largeText);
      wide.push(...found.map((each) => `${path}: ${each}`));
    }

    expect(wide).toEqual([]);
  },
);
