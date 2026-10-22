import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";

import { Then } from "./fixtures";

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
