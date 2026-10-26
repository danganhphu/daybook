import { expect, type Page } from "@playwright/test";
import type { DataTable } from "playwright-bdd";

import { Then, When } from "./fixtures";
import { fillLinesAndSave } from "./order-form";

// Customers and orders, found by role and by the words on screen

function customerRow(page: Page, name: string) {
  return page.getByRole("link").filter({ has: page.getByText(name, { exact: true }) });
}

When("tôi mở trang Khách hàng", async ({ page }) => {
  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: "Khách hàng", level: 1 })).toBeVisible();
});

When("tôi mở trang Đơn hàng", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Đơn hàng", level: 1 })).toBeVisible();
});

When("tôi tìm khách {string}", async ({ page }, words: string) => {
  const box = page.getByRole("searchbox", { name: "Tìm khách" });
  await box.fill(words);
  await box.press("Enter");
  await expect(page).toHaveURL(/\?q=/);
});

When("tôi chọn loại {string}", async ({ page }, kind: string) => {
  await page.getByRole("link", { name: kind, exact: true }).click();
  await expect(page.getByRole("link", { name: kind, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

When("tôi chọn {string}", async ({ page }, chip: string) => {
  await page.getByRole("link", { name: chip, exact: true }).click();
  await expect(page.getByRole("link", { name: chip, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

Then("có khách {string}", async ({ page }, name: string) => {
  await expect(customerRow(page, name)).toBeVisible();
});

Then("không có khách {string}", async ({ page }, name: string) => {
  await expect(customerRow(page, name)).toHaveCount(0);
});

Then("khách {string} còn nợ {string}", async ({ page }, name: string, amount: string) => {
  await expect(customerRow(page, name)).toContainText(`Còn nợ ${amount}`);
});

When(
  "tôi thêm khách {string} ở {string}, loại {string}",
  async ({ page }, name: string, area: string, kind: string) => {
    await page.goto("/customers/new");
    await page.getByRole("textbox", { name: "Tên khách" }).fill(name);
    await page.getByRole("combobox", { name: "Loại khách" }).selectOption({ label: kind });
    await page.getByRole("textbox", { name: "Khu vực" }).fill(area);
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
  },
);

// The error is tied to its field, and the refused field has the focus, so a screen reader says both
Then("ô {string} báo {string}", async ({ page }, field: string, message: string) => {
  const box = page.getByRole("textbox", { name: field });
  await expect(box).toHaveAccessibleDescription(message);
  await expect(box).toBeFocused();
});

Then("tôi đang xem khách {string}", async ({ page }, name: string) => {
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
});

When(
  "tôi tạo đơn cho khách {string} gồm:",
  async ({ page }, customer: string, table: DataTable) => {
    await page.goto("/customers");
    await customerRow(page, customer).first().click();
    await page.getByRole("link", { name: "Tạo đơn" }).click();
    await fillLinesAndSave(page, table.hashes());
  },
);

When(
  "tôi tạo đơn ở trang Đơn hàng, gõ {string} rồi chọn khách {string}, gồm:",
  async ({ page }, typed: string, customer: string, table: DataTable) => {
    await page.goto("/orders/new");
    const field = page.getByRole("combobox", { name: "Khách" });
    await expect(field).toBeEnabled();
    await field.fill(typed);
    await page.getByRole("option", { name: new RegExp(customer) }).click();
    await fillLinesAndSave(page, table.hashes());
  },
);

Then("đơn là của khách {string}", async ({ page }, customer: string) => {
  await expect(page.getByRole("heading", { name: customer, level: 1 })).toBeVisible();
});

When("tôi thu {string}", async ({ page }, amount: string) => {
  await page.getByRole("button", { name: "Thu tiền" }).click();
  const dialog = page.getByRole("dialog", { name: "Thu tiền" });
  await dialog.getByRole("textbox", { name: "Số tiền (đ)" }).fill(amount);
  await dialog.getByRole("button", { name: "Thu tiền" }).click();
});

When("tôi đánh dấu đã giao hôm nay", async ({ page }) => {
  await page.getByRole("button", { name: "Đã giao hôm nay" }).click();
  await expect(page.getByRole("button", { name: "Bỏ đánh dấu đã giao" })).toBeVisible();
});

Then("đơn có tổng {string} và còn nợ {string}", async ({ page }, total: string, owed: string) => {
  const numbers = page.getByRole("definition");
  await expect(numbers.nth(0)).toHaveText(total);
  await expect(numbers.nth(2)).toHaveText(owed);
});

Then("lịch sử đơn có {string}", async ({ page }, headline: string) => {
  await expect(
    page.getByRole("listitem").filter({ has: page.getByText(headline, { exact: true }) }),
  ).not.toHaveCount(0);
});

Then("có đơn của {string} giá {string}", async ({ page }, customer: string, total: string) => {
  await expect(
    page
      .getByRole("link")
      .filter({ has: page.getByText(customer, { exact: true }) })
      .filter({ hasText: total })
      .first(),
  ).toBeVisible();
});
