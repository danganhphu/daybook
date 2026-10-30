import { expect, type Page } from "@playwright/test";

import { Then, When } from "./fixtures";
import { ownName } from "./own-names";

// Products, found by role and by the words on screen

function mainLink(page: Page, text: string) {
  return page
    .getByRole("main")
    .getByRole("link")
    .filter({ has: page.getByText(text, { exact: true }) });
}

// The page's own menu, not a row's: its name is the bare "Tuỳ chọn"
async function pick(page: Page, item: string) {
  await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

async function saveName(page: Page, title: string, name: string) {
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await dialog.getByRole("textbox", { name: "Tên sản phẩm" }).fill(name);
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(dialog).toBeHidden();
}

When("tôi mở trang Sản phẩm từ trang Đơn hàng", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sản phẩm", level: 1 })).toBeVisible();
});

When("tôi thêm sản phẩm {string}", async ({ page, remembered }, name: string) => {
  await page.getByRole("button", { name: "Thêm sản phẩm", exact: true }).click();
  await saveName(page, "Thêm sản phẩm", ownName(remembered, name));
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
});

Then("tôi đang xem sản phẩm mới {string}", async ({ page, remembered }, name: string) => {
  await expect(
    page.getByRole("heading", { name: ownName(remembered, name), level: 1 }),
  ).toBeVisible();
});

When("tôi đổi tên sản phẩm thành {string}", async ({ page, remembered }, name: string) => {
  await pick(page, "Đổi tên");
  await saveName(page, "Đổi tên", ownName(remembered, name));
});

When("tôi ẩn sản phẩm này", async ({ page }) => {
  await pick(page, "Ẩn sản phẩm");
});

When("tôi hiện lại sản phẩm này", async ({ page }) => {
  await pick(page, "Hiện lại");
});

When("tôi xoá sản phẩm này", async ({ page }) => {
  await pick(page, "Xoá sản phẩm");
});

When("tôi mở đơn của {string} giá {string}", async ({ page }, customer: string, total: string) => {
  await page.goto("/orders");
  await mainLink(page, customer).filter({ hasText: total }).first().click();
  await expect(page.getByRole("heading", { name: customer, level: 1 })).toBeVisible();
});

When("tôi bấm vào sản phẩm {string}", async ({ page }, name: string) => {
  await mainLink(page, name).first().click();
});

Then(
  "tôi đang xem sản phẩm {string} có đơn của {string}",
  async ({ page }, name: string, customer: string) => {
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
    await expect(mainLink(page, customer).first()).toBeVisible();
  },
);
