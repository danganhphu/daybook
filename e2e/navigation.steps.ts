import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

// Long past the second the bar waits for, short of the five an expectation waits
const slowScreen = 2500;

const progress = "Đang tải trang";

// Only the screen's data fetched by the app; the first load of a page is the browser's own
Given("màn {string} đang tới chậm", async ({ page }, path: string) => {
  await page.route(
    (url) => url.pathname.startsWith(path),
    async (route) => {
      if (route.request().resourceType() === "fetch") {
        await new Promise((resolve) => setTimeout(resolve, slowScreen));
      }
      await route.fallback();
    },
  );
});

When("tôi bấm tab {string}", async ({ page }, tab: string) => {
  await page
    .getByRole("navigation", { name: "Mục chính" })
    .getByRole("link", { name: tab })
    .click();
});

Then("có thanh chờ chạy ở mép trên", async ({ page }) => {
  await expect(page.getByRole("progressbar", { name: progress })).toBeVisible();
});

Then("thanh chờ đã tắt", async ({ page }) => {
  await expect(page.getByRole("progressbar", { name: progress })).toBeHidden();
});
