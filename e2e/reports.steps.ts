import { expect, type Page } from "@playwright/test";
import { Temporal } from "temporal-polyfill/implementation";

import { vietnamDate } from "@/shared/domain/vietnam-day";

import { Then, When } from "./fixtures";

// The reports screen, found by role and by the words on it. Days are Vietnam's, as the seed's "yesterday" is.

function today(): Temporal.PlainDate {
  return vietnamDate(Temporal.Now.instant());
}

function yesterday(): Temporal.PlainDate {
  return today().subtract({ days: 1 });
}

function chart(page: Page) {
  return page.getByRole("region", { name: "Doanh số theo ngày" });
}

// The card of rows under a ranking's heading
function ranking(page: Page, heading: string) {
  return page
    .getByRole("heading", { name: heading, level: 2 })
    .locator("xpath=following-sibling::ul[1]");
}

async function showRange(page: Page, from: Temporal.PlainDate, to: Temporal.PlainDate) {
  await page.goto("/reports");
  await page
    .getByRole("navigation", { name: "Kỳ báo cáo" })
    .getByRole("link", { name: "Khoảng ngày" })
    .click();
  await page.getByLabel("Từ ngày").fill(from.toString());
  await page.getByLabel("Đến ngày").fill(to.toString());
  await page.getByRole("button", { name: "Xem", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${from.toString()}&to=${to.toString()}`));
}

When("tôi mở trang Báo cáo", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Báo cáo", level: 1 })).toBeVisible();
});

When("tôi xem báo cáo ngày hôm qua", async ({ page }) => {
  await showRange(page, yesterday(), yesterday());
});

When("tôi xem báo cáo từ hôm qua tới hôm nay", async ({ page }) => {
  await showRange(page, yesterday(), today());
});

Then("báo cáo có {string} là {string}", async ({ page }, label: string, value: string) => {
  const term = page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) });
  await expect(term.locator("xpath=following-sibling::dd[1]")).toHaveText(value);
});

Then(
  "sản phẩm bán chạy có {string} với {string}",
  async ({ page }, product: string, value: string) => {
    const row = ranking(page, "Sản phẩm bán chạy")
      .getByRole("listitem")
      .filter({ hasText: product });
    await expect(row).toContainText(value);
  },
);

When("tôi chạm {string} trong sản phẩm bán chạy", async ({ page }, product: string) => {
  await ranking(page, "Sản phẩm bán chạy").getByRole("link").filter({ hasText: product }).click();
});

Then("báo cáo đang lọc theo {string}", async ({ page }, name: string) => {
  await expect(
    page
      .getByRole("navigation", { name: "Đang lọc" })
      .getByRole("link", { name: `Bỏ lọc ${name}` }),
  ).toBeVisible();
});

When("tôi bỏ lọc {string}", async ({ page }, name: string) => {
  await page.getByRole("link", { name: `Bỏ lọc ${name}` }).click();
});

Then("báo cáo không lọc theo gì", async ({ page }) => {
  await expect(page.getByRole("navigation", { name: "Đang lọc" })).toHaveCount(0);
});

// The columns fill the plot, so a tap on their list is a tap on the plot
When("tôi chạm vào nửa trái biểu đồ", async ({ page }) => {
  const columns = chart(page).locator("ol").first();
  const box = await columns.boundingBox();
  if (box === null) {
    throw new Error("The chart's columns are not on screen");
  }
  await columns.click({ position: { x: box.width / 4, y: box.height / 2 } });
});

Then("biểu đồ đọc {string} cho ngày hôm qua", async ({ page }, value: string) => {
  const readout = chart(page).locator("p").first();
  await expect(readout).toContainText(value);
  await expect(readout).not.toContainText("Cao nhất");
});

When("tôi bấm phím Home trên biểu đồ", async ({ page }) => {
  await chart(page).getByRole("slider").press("Home");
});

Then("thanh trượt của biểu đồ đọc {string}", async ({ page }, value: string) => {
  await expect(chart(page).getByRole("slider")).toHaveAttribute(
    "aria-valuetext",
    new RegExp(value.replaceAll(".", "\\.")),
  );
});

When("tôi chọn kỳ {string}", async ({ page }, kind: string) => {
  await page
    .getByRole("navigation", { name: "Kỳ báo cáo" })
    .getByRole("link", { name: kind, exact: true })
    .click();
});

When("tôi lùi một kỳ", async ({ page }) => {
  await page.getByRole("link", { name: "Kỳ trước" }).click();
});

function periodHeading(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true, level: 2 });
}

Then("kỳ đang xem là tháng này", async ({ page }) => {
  await expect(periodHeading(page, `Tháng ${today().month}/${today().year}`)).toBeVisible();
});

Then("kỳ đang xem là năm nay", async ({ page }) => {
  await expect(periodHeading(page, `Năm ${today().year}`)).toBeVisible();
});

Then("kỳ đang xem là năm ngoái", async ({ page }) => {
  await expect(periodHeading(page, `Năm ${today().year - 1}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Kỳ sau" })).toBeVisible();
});
