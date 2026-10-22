import { randomBytes } from "node:crypto";

import { expect } from "@playwright/test";

import { giveFaceId } from "./face-id";
import { Given, Then, When } from "./fixtures";

Given("tôi đã đăng nhập", async ({ access }) => {
  await access.signIn();
});

Given("tôi chưa đăng nhập", async ({ context }) => {
  await context.clearCookies();
});

Given("máy này có Face ID", async ({ page }) => {
  await giveFaceId(page);
});

When("tôi mở trang {string}", async ({ page }, path: string) => {
  await page.goto(path);
});

When("tôi mở link cài đặt mới", async ({ page, access }) => {
  await page.goto(`/setup#${access.nextSetupToken()}`);
});

When("tôi mở một link cài đặt không có thật", async ({ page }) => {
  await page.goto(`/setup#${randomBytes(32).toString("base64url")}`);
});

When("tôi đăng xuất", async ({ page }) => {
  await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
});

Then("tôi đang ở trang đăng nhập", async ({ page }) => {
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập", level: 1 })).toBeVisible();
});

Then("tôi đang ở trang Hôm nay", async ({ page }) => {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Hôm nay", level: 1 })).toBeVisible();
});

// What a form or a fetch on another site would send: the browser marks it cross-site, and the proxy must refuse it
// before any server action runs
Then("một trang web khác không gửi được ghi chú vào daybook", async ({ request }) => {
  const response = await request.post("/", {
    headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
    form: { text: "ghi lén" },
  });

  expect(response.status()).toBe(403);
});
