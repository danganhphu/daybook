import { expect } from "@playwright/test";
import { Temporal } from "temporal-polyfill/implementation";

import { vietnamDate } from "@/shared/domain/vietnam-day";

import { Then, When } from "./fixtures";

When("tôi lùi về ngày trước", async ({ page }) => {
  await page.getByRole("navigation", { name: "Chuyển ngày" }).getByRole("link").first().click();
});

When("tôi tìm {string}", async ({ page }, words: string) => {
  await page.goto("/history");
  const box = page.getByRole("searchbox", { name: "Tìm ghi chú" });
  await box.fill(words);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/history\?q=/);
});

When("tôi mở ngày có ghi chú {string}", async ({ page }, text: string) => {
  await page
    .getByRole("region")
    .filter({ has: page.getByText(text, { exact: true }) })
    .getByRole("heading")
    .getByRole("link")
    .click();
});

When("tôi mở trang của ngày mai", async ({ page }) => {
  const tomorrow = vietnamDate(Temporal.Now.instant()).add({ days: 1 });
  await page.goto(`/days/${tomorrow.toString()}`);
});

Then("tôi đang xem {string}", async ({ page }, title: string) => {
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});

Then("có ghi chú {string}", async ({ today }, text: string) => {
  await expect(today.note(text)).toBeVisible();
});

Then("không có ô ghi chú mới", async ({ today }) => {
  await expect(today.box).toHaveCount(0);
});
