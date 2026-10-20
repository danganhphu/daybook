import { expect, type Page } from "@playwright/test";
import { z } from "zod";

import { Then } from "./fixtures";

const manifestIcons = z.object({
  icons: z.array(z.object({ src: z.string(), sizes: z.string() })).nonempty(),
});

// A PNG states its size in the IHDR chunk, right after the 8-byte signature and the chunk's length and type
function pngSize(png: Buffer) {
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

async function expectPng(page: Page, url: string, size: string) {
  const response = await page.request.get(url);
  expect(response.ok(), url).toBe(true);
  expect(response.headers()["content-type"], url).toBe("image/png");
  expect(pngSize(await response.body()), url).toBe(size);
}

async function linkTarget(page: Page, rel: string) {
  const link = page.locator(`link[rel="${rel}"]`);
  await expect(link).toHaveAttribute("href", /.+/);
  return (await link.getAttribute("href")) ?? "";
}

// Chrome's own verdict over the DevTools protocol. Playwright's contexts are off the record, which Chrome counts
// against installing, so that one error is set aside.
Then("Chrome cho cài trang thành app {string}", async ({ page }, name: string) => {
  const devTools = await page.context().newCDPSession(page);
  const { installabilityErrors } = await devTools.send("Page.getInstallabilityErrors");
  const errors = installabilityErrors
    .map(({ errorId }) => errorId)
    .filter((id) => id !== "in-incognito");
  expect(errors).toEqual([]);

  const { data } = await devTools.send("Page.getAppManifest");
  const manifest: unknown = JSON.parse(data ?? "{}");
  expect(manifest).toMatchObject({ name, short_name: name, lang: "vi" });
});

// Chrome installs with one good icon, so its verdict alone would miss a broken one
Then("mọi icon trong manifest tải được và đúng cỡ đã khai", async ({ page }) => {
  const response = await page.request.get(await linkTarget(page, "manifest"));
  const { icons } = manifestIcons.parse(await response.json());
  for (const icon of icons) {
    await expectPng(page, icon.src, icon.sizes);
  }
});

Then("trang có icon {int}px cho màn hình chính iPhone", async ({ page }, size: number) => {
  await expectPng(page, await linkTarget(page, "apple-touch-icon"), `${size}x${size}`);
});

Then("tên dưới icon trên iPhone là {string}", async ({ page }, name: string) => {
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    name,
  );
});
