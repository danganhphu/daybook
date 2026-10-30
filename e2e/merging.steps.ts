import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";
import { fillLinesAndSave } from "./order-form";
import { ownName } from "./own-names";

// Merging customers, found by role and by the words on screen. Each customer is this scenario's own, its page
// remembered by the name the feature file gives it.

function pageKey(name: string): string {
  return `page of ${name}`;
}

Given(
  "có khách mới {string} với đơn {string} giá {string}",
  async ({ page, remembered }, name: string, product: string, price: string) => {
    await page.goto("/customers/new");
    await page.getByRole("textbox", { name: "Tên khách" }).fill(ownName(remembered, name));
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
    remembered.set(pageKey(name), page.url());

    await page.getByRole("link", { name: "Tạo đơn" }).click();
    await fillLinesAndSave(page, [{ "sản phẩm": product, "số lượng": "1", "đơn giá": price }]);
  },
);

When(
  "tôi gộp khách {string} vào {string}",
  async ({ page, remembered }, merged: string, kept: string) => {
    const from = ownName(remembered, merged);
    const into = ownName(remembered, kept);
    await page.goto(remembered.get(pageKey(merged)) ?? "/customers");
    await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
    await page.getByRole("menuitem", { name: "Gộp vào khách khác" }).click();

    const picker = page.getByRole("dialog", { name: "Gộp vào khách nào?" });
    await picker.getByRole("combobox", { name: "Khách giữ lại" }).fill(into);
    await page.getByRole("option", { name: new RegExp(into) }).click();

    const confirm = page.getByRole("dialog", { name: `Gộp "${from}" vào "${into}"?` });
    await expect(confirm).toContainText("1 đơn");
    await confirm.getByRole("button", { name: "Gộp", exact: true }).click();
    await expect(page).toHaveURL(remembered.get(pageKey(kept)) ?? /\/customers\//);
  },
);

When("tôi mở khách mới {string}", async ({ page, remembered }, name: string) => {
  await page.goto(remembered.get(pageKey(name)) ?? "/customers");
  await expect(
    page.getByRole("heading", { name: ownName(remembered, name), level: 1 }),
  ).toBeVisible();
});

When("tôi chọn {string} trong menu của khách này", async ({ page }, item: string) => {
  await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
});

Then("tôi đang xem khách mới {string}", async ({ page, remembered }, name: string) => {
  await expect(
    page.getByRole("heading", { name: ownName(remembered, name), level: 1 }),
  ).toBeVisible();
});

Then("khách này còn nợ {string}", async ({ page }, amount: string) => {
  const term = page.getByRole("term").filter({ hasText: /^Còn nợ$/ });
  await expect(term.locator("xpath=following-sibling::dd[1]")).toHaveText(amount);
});

Then("khách này có tên khác {string}", async ({ page, remembered }, name: string) => {
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ has: page.getByText(ownName(remembered, name), { exact: true }) }),
  ).toBeVisible();
});
