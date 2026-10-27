import { expect, type Page } from "@playwright/test";

import { Given, Then, When } from "./fixtures";
import type { TodayPage } from "./today-page";

// The model taking its time, as Workers AI did on the phone (3.7 s): every reading's answer is held back
const slowReading = 4000;

Given("đọc tin đang chậm", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (await request.headerValue("next-action"))?.endsWith("#readNote")
    ) {
      await new Promise((resolve) => setTimeout(resolve, slowReading));
    }
    await route.fallback();
  });
});

Then("ghi chú {string} sửa, xoá được trong lúc còn đang đọc", async ({ today }, text: string) => {
  const row = today.note(text);
  await expect(row.getByRole("status")).toHaveText("Đang đọc tin...");
  await expect(row.getByRole("button", { name: /^Tuỳ chọn/ })).toBeVisible();
  await expect(row.getByRole("status")).toBeVisible();
});

// What a note's message became, found under the note's words by role and by what it says

Then("ghi chú {string} ghi {string}", async ({ today }, text: string, said: string) => {
  await expect(today.note(text)).toContainText(said);
});

// Nothing beneath the words: no line to open, no question, nothing under way; only the note's own menu
Then("ghi chú {string} không còn ghi gì thêm", async ({ today }, text: string) => {
  const row = today.note(text);
  await today.expectSaved(row);
  await expect(row.getByRole("link")).toHaveCount(0);
  await expect(row.getByRole("status")).toHaveCount(0);
  await expect(row.getByRole("button")).toHaveCount(1);
});

async function openWhatWasMade(today: TodayPage, text: string) {
  await today.note(text).getByRole("link").click();
}

When("tôi mở đơn vừa ghi từ ghi chú {string}", async ({ today }, text: string) => {
  await openWhatWasMade(today, text);
});

When("tôi mở việc vừa nhắc từ ghi chú {string}", async ({ page, today }, text: string) => {
  await openWhatWasMade(today, text);
  await expect(page.getByRole("heading", { name: "Việc cần nhắc", level: 1 })).toBeVisible();
});

// Waits for the server's answer, so what follows sees the note as it now is
async function answered(page: Page, act: () => Promise<void>) {
  const response = page.waitForResponse((each) => each.request().method() === "POST");
  await act();
  await response;
}

When("tôi bấm {string} ở ghi chú {string}", async ({ page, today }, name: string, text: string) => {
  await answered(page, () => today.note(text).getByRole("button", { name, exact: true }).click());
});

When(
  "tôi chọn khách {string} cho ghi chú {string}, gõ {string}",
  async ({ page, today }, customer: string, text: string, typed: string) => {
    await today.note(text).getByRole("button", { name: "Chọn khách", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Chọn khách cho đơn" });
    const field = dialog.getByRole("combobox", { name: "Khách" });
    await expect(field).toBeEnabled();
    await field.fill(typed);
    await answered(page, () => page.getByRole("option", { name: new RegExp(customer) }).click());
    await expect(dialog).toBeHidden();
  },
);
