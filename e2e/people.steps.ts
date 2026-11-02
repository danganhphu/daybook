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

Then("không có nút {string}", async ({ page }, name: string) => {
  await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
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
