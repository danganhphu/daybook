import { expect, type Page } from "@playwright/test";

import { giveFaceId } from "./face-id";
import { Then, When } from "./fixtures";

const linkKey = "link";

// The link the dialog shows once, kept for the "other phone" to open
async function keepShownLink(page: Page, remembered: Map<string, string>, title: string | RegExp) {
  const dialog = page.getByRole("dialog", { name: title });
  const url = await dialog.getByRole("textbox", { name: "Link", exact: true }).inputValue();
  expect(url).toMatch(/\/setup#[A-Za-z0-9_-]{43}$/);
  remembered.set(linkKey, url);
}

When("tôi mời một người dùng mới", async ({ page, remembered }) => {
  await page.getByRole("button", { name: "Mời người dùng", exact: true }).click();
  await keepShownLink(page, remembered, "Link mời");
});

When("tôi tạo link khôi phục cho {string}", async ({ page, remembered }, name: string) => {
  await page.getByRole("button", { name: `Tuỳ chọn cho ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Tạo link khôi phục" }).click();
  await keepShownLink(page, remembered, `Tạo link khôi phục cho ${name}`);
});

// Another phone: nobody signed in, with Face ID of its own. The same browser, emptied, stands in for it.
When("người được mời mở link trên máy của họ", async ({ page, context, remembered }) => {
  const url = remembered.get(linkKey);
  if (url === undefined) {
    throw new Error("No link was shown earlier in this scenario");
  }
  await context.clearCookies();
  await giveFaceId(page);
  await page.goto(url);
});

Then("họ được hỏi tên", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Tạo tài khoản", level: 1 })).toBeVisible();
});

// Each run makes a new account, so the username is new every time
When(
  "họ chọn tên {string} và một tên đăng nhập chưa ai dùng",
  async ({ page }, displayName: string) => {
    await page.getByLabel("Tên", { exact: true }).fill(displayName);
    await page
      .getByLabel("Tên đăng nhập", { exact: true })
      .fill(`khach.${Date.now().toString(36)}`);
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  },
);
