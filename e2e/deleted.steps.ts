import { expect } from "@playwright/test";

import { When } from "./fixtures";

// "Đã xoá gần đây", reached from Settings, found by role and by the words on screen

When("tôi mở Đã xoá gần đây từ Cài đặt", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /^Đã xoá gần đây/ }).click();
  await expect(page.getByRole("heading", { name: "Đã xoá gần đây", level: 1 })).toBeVisible();
});

// The latest deleted comes first; other runs on the same book may have deleted the same words before
When("tôi khôi phục {string}", async ({ page }, text: string) => {
  await page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByText(text, { exact: true }) })
    .first()
    .getByRole("button", { name: "Khôi phục", exact: true })
    .click();
});
