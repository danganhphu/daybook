import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

Given("hôm nay chưa có ghi chú nào", async ({ today }) => {
  await today.clear();
});

Given("hôm nay chỉ có ghi chú {string}", async ({ today }, text: string) => {
  await today.clear();
  await today.record(text);
  await today.expectSaved(today.note(text));
});

Given("mất kết nối mạng", async ({ context }) => {
  await context.setOffline(true);
});

When("tôi gõ {string} và gửi", async ({ today }, text: string) => {
  await today.record(text);
});

When("tôi gõ và gửi:", async ({ today }, text: string) => {
  await today.record(text);
});

When("tôi gửi mà không gõ gì", async ({ today }) => {
  await today.send.click();
});

When("tôi gõ {string} rồi nhấn Enter", async ({ today }, text: string) => {
  await today.box.fill(text);
  await today.box.press("Enter");
});

When("tôi sửa ghi chú {string} thành {string}", async ({ today }, from: string, to: string) => {
  await today.edit(from, to);
});

When("tôi xoá ghi chú {string}", async ({ today }, text: string) => {
  await today.remove(text);
});

When("tôi bấm {string}", async ({ page }, name: string) => {
  await page.getByRole("button", { name, exact: true }).click();
});

Then("tôi thấy {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
});

Then("ghi chú {string} hiện trong hôm nay", async ({ today }, text: string) => {
  await today.expectSaved(today.note(text));
});

// textContent, not toHaveText: toHaveText collapses the line breaks this checks for
Then("ghi chú cuối cùng đúng như đã gõ:", async ({ today }, text: string) => {
  const last = today.notes.last();
  await today.expectSaved(last);
  expect(await last.getByRole("paragraph").textContent()).toBe(text);
});

Then("không còn ghi chú {string}", async ({ today }, text: string) => {
  await expect(today.note(text)).toHaveCount(0);
});

Then("ô nhập trống", async ({ today }) => {
  await expect(today.box).toHaveValue("");
});

Then("ô nhập vẫn còn {string}", async ({ today }, text: string) => {
  await expect(today.box).toHaveValue(text);
});

Then("ô nhập xuống dòng sau {string}", async ({ today }, text: string) => {
  await expect(today.box).toHaveValue(`${text}\n`);
  await expect(today.notes).toHaveCount(0);
});

Then("tôi thấy lỗi {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible();
});

Then("tôi thấy thông báo {string}", async ({ page }, title: string) => {
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
});
