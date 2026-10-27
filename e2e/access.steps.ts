import { randomBytes } from "node:crypto";

import { expect } from "@playwright/test";

import { giveFaceId } from "./face-id";
import { Given, Then, When } from "./fixtures";

Given("tôi đã đăng nhập", async ({ access }) => {
  await access.signIn();
});

// Signed in at the start of the scenario, not when the run began: security settings need a sign-in from the last five
// minutes, and a whole run takes longer
Given("tôi vừa đăng nhập bằng mật khẩu", async ({ page, context, access }) => {
  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Dùng mật khẩu", exact: true }).click();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("lan");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(access.lanPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hôm nay", level: 1 })).toBeVisible();
});

// In the same tab, by the session cookie: a password sign-in per run would spend the account's attempts, and the
// sign-in screen itself has scenarios of its own
When("tôi đăng nhập lại rồi về trang Hôm nay", async ({ page, access }) => {
  await access.signIn();
  await page.goto("/");
});

Given("tôi chưa đăng nhập", async ({ context }) => {
  await context.clearCookies();
});

Given("phiên đăng nhập vừa hết", async ({ context }) => {
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

// The page's clock jumps, the server's does not: what is checked is that the page fetched a fresh prompt by itself
When("tôi mở trang đăng nhập rồi để đó 5 phút", async ({ page }) => {
  await page.clock.install();
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeEnabled();
  const freshPrompt = page.waitForResponse((response) => response.request().method() === "POST");
  await page.clock.fastForward("05:00");
  await freshPrompt;
});

When("tôi mở một link cài đặt không có thật", async ({ page }) => {
  await page.goto(`/setup#${randomBytes(32).toString("base64url")}`);
});

When("tôi đăng xuất", async ({ page }) => {
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
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
